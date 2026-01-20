import { createLogger, format as wFormat, transports as wTransports } from "winston";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { Room } from "../game/room.js";
import type { ClientEvents, ServerEvents } from "../game/events.js";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import cluster from "cluster";
import os from "os";
import { saveRoomState, loadRoom } from "./roomStateManager.js";
import { roomID, ID } from "../game/types.js";
import { v4 as uuidv4 } from "uuid";
import session from "express-session";
import { RedisStore } from "connect-redis";
import cookieParser from "cookie-parser";
import {
  CLEANUP_USER_LUA,
  GET_ROOM_BY_USER_ID_LUA,
  MATCH_USER_LUA,
  USER_SOCKETS_PREFIX,
  USER_TO_ROOM_PREFIX,
  WAITING_ROOMS_ZSET,
} from "./lua-scripts.js";
import cors from "cors";

const SESSION_SECRET = process.env.SESSION_SECRET || "your-super-secret-session-key"; //TODO
const COOKIE_NAME = "s4feashouses.sid";

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: wFormat.combine(wFormat.timestamp(), wFormat.simple()),
  transports: [new wTransports.File({ filename: "app.log" }), new wTransports.Console()],
});

// Extend session data to include our userId
declare module "express-session" {
  interface SessionData {
    userId: ID;
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(express.static("public"));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

const server = createServer(app);
const io = new Server<ClientEvents, ServerEvents>(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  },
});

// Configure session middleware
const redisClientForStore = createClient({
  url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
});
redisClientForStore.connect().catch(console.error);

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClientForStore }),
  secret: SESSION_SECRET,
  name: COOKIE_NAME,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2,
  },
});

app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.json());

app.get("/auth/guest", (req, res) => {
  if (!req.session.userId) {
    req.session.userId = uuidv4() as ID;
    logger.info(`New guest session created with userId: ${req.session.userId}`);
    req.session.save((err) => {
      if (err) {
        logger.error("Error saving session:", err);
        return res.status(500).json({ error: "Could not create session" });
      }
      res.status(200).json({ userId: req.session.userId });
    });
  } else {
    res.status(200).json({ userId: req.session.userId });
  }
});

async function startWorker() {
  logger.info(`Worker ${process.pid} starting...`);
  try {
    const redisClient = redisClientForStore.duplicate();
    redisClient.on("error", (err) => logger.error("Redis Client Error", err));
    await redisClient.connect();

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info(`Worker ${process.pid} connected to Redis and using adapter`);

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    // Give other workers a bit more time to create and persist the Room state
    // before we give up. This helps avoid race conditions during matchmaking.
    const waitAndLoadRoom = async (roomId: roomID, attempts = 20, delay = 100) => {
      for (let i = 0; i < attempts; i++) {
        const r = await loadRoom(redisClient as any, roomId, io, logger);
        if (r) return r;
        await sleep(delay);
      }
      return null;
    };

    // Make express-session accessible to Socket.IO
    io.use((socket, next) => {
      // This is a wrapper to allow express-session to work with Socket.IO
      // @ts-ignore
      sessionMiddleware(socket.request, {}, () => {
        //@ts-ignore
        logger.debug("Session in socket:", socket.request.session);
        next();
      });
    });

    // Authorization middleware for Socket.IO
    io.use((socket, next) => {
      // @ts-ignore
      const session = socket.request.session;
      if (session && session.userId) {
        socket.data.userId = session.userId;
        next();
      } else {
        logger.warn(`Socket ${socket.id} tried to connect without a valid session.`);
        next(new Error("Unauthorized"));
      }
    });

    io.on("connection", (socket) => {
      logger.info(`Socket ${socket.id} connected with userId: ${socket.data.userId}`);
      const userId = socket.data.userId;

      // Join a room based on the user ID to allow for direct messaging.
      socket.join(userId);

      redisClient.sAdd(`userSockets:${userId}`, socket.id);

      socket.on("disconnect", async () => {
        if (userId) {
          // Redis cleanup
          await redisClient.eval(CLEANUP_USER_LUA, {
            keys: [`userSockets:${userId}`],
            arguments: [socket.id],
          });

          logger.info(`User ${userId} disconnected on socket ${socket.id} `);
        }
      });

      socket.on("joinGame", async (username: string) => {
        try {
          const userId = socket.data.userId;
          const MAX_PLAYERS = 4;

          const res = await redisClient.eval(MATCH_USER_LUA, {
            keys: [WAITING_ROOMS_ZSET],
            arguments: [MAX_PLAYERS.toString(), userId, USER_TO_ROOM_PREFIX, USER_SOCKETS_PREFIX],
          });

          if (!res || !Array.isArray(res)) {
            logger.warn(`Invalid response from MATCH_USER_LUA for user ${userId}`);
            return;
          }

          const [matchType, roomId, ...rest] = res as [string, roomID, ...any[]];

          if (matchType === "RECONNECT") {
            const socketIds = rest[0] as string[];
            const existingRoom = await loadRoom(redisClient as any, roomId, io, logger);
            if (existingRoom) {
              // The socket needs to join the room before receiving events.
              socket.join(roomId);

              logger.info(`User ${userId} reconnected to existing room ${existingRoom.id}`);
              // @ts-ignore - Touch the session to reset the expiration timer
              socket.request.session.touch();
              if (existingRoom.gameStarted) {
                existingRoom.sendReconnectionState(userId);
              } else {
                existingRoom.sendRoom("joinGameAck", existingRoom.players.length);
              }
            } else {
              await redisClient.del(`${USER_TO_ROOM_PREFIX}${userId}`);
              logger.warn(
                `User ${userId} tried to reconnect to non-existent room ${roomId}. Stale mapping deleted.`,
              );
            }
            return;
          }

          if (matchType === "MATCH") {
            const newPlayerCountStr = rest[0] as string;
            const socketIds = rest[1] as string[];
            const newPlayerCount = parseInt(newPlayerCountStr, 10);
            let room: Room | null;
            logger.info(
              `MATCH response for user ${userId}: room=${roomId} players=${newPlayerCount}`,
            );

            if (newPlayerCount === 1) {
              room = new Room(io, logger);
              room.id = roomId;
              logger.info(`Created Room instance for ${roomId} on worker ${process.pid}`);
            } else {
              room = await waitAndLoadRoom(roomId);
              if (!room) {
                logger.error(
                  `Failed to load room ${roomId} after waiting. Matchmaking may be inconsistent.`,
                );
                return;
              }
              logger.info(`Loaded room ${roomId} from Redis on worker ${process.pid}`);
            }

            let playerCount = room.addPlayer(userId, username);

            logger.info("User added:", userId);

            // **IMMEDIATELY** join the current socket to the main game room.
            // The redis adapter will handle synchronization across the cluster.
            socket.join(roomId);
            logger.info(`Socket ${socket.id} has joined room ${roomId}`);

            // First, acknowledge the join for all players so clients can update their lobby UI.
            room.sendRoom("joinGameAck", playerCount);

            if (newPlayerCount === MAX_PLAYERS) {
              logger.info(`Room ${room.id} is full, starting game...`);
              room.startGame();
            }

            // The state must always be saved after a player is added or the game starts.
            try {
              await saveRoomState(redisClient as any, room);
              logger.info(`Saved room state for ${room.id}`);
            } catch (err) {
              logger.error(`Failed to save room ${room.id}:`, err);
            }
          }
        } catch (err) {
          logger.error("Error during joinGame:", err);
        }
      });

      const withRoom = (handler: (room: Room, ...args: any[]) => Promise<void>) => {
        return async (...args: any[]) => {
          const userId = socket.data.userId;

          try {
            const res = await redisClient.eval(GET_ROOM_BY_USER_ID_LUA, {
              arguments: [userId, USER_TO_ROOM_PREFIX],
            });

            if (res && Array.isArray(res)) {
              const [roomId, roomData] = res as [roomID, string];
              // We have the raw room data, so we can deserialize it directly instead of calling loadRoom.
              const room = Room.deserialize(roomData, io, logger);
              room.id = roomId;

              await handler(room, ...args);
              await saveRoomState(redisClient as any, room);
            } else {
              logger.warn(`User ${userId} tried to perform an action but is not in a valid room.`);
            }
          } catch (err) {
            logger.error(`Error processing event for user ${userId}:`, err);
          }
        };
      };

      socket.on(
        "submitTurn",
        withRoom(async (room) => {
          // The handler now correctly receives the room object.
          if (room.isPlayerTurn(socket.data.userId)) {
            room.advanceTurn();
          }
        }),
      );
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Worker ${process.pid} is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error(`Worker ${process.pid} failed to start.`, err);
    process.exit(1);
  }
}

// Optionally run in cluster mode. Enable by setting `CLUSTER=true`.
const useCluster = process.env.CLUSTER === "true";

if (useCluster && cluster.isPrimary) {
  const workerCount = Number(process.env.WORKERS) || os.cpus().length;
  logger.info(`Primary ${process.pid} starting ${workerCount} workers (CLUSTER=true)`);

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      `Worker ${worker.process.pid} exited (code=${code} signal=${signal}), restarting...`,
    );
    cluster.fork();
  });
} else {
  // Worker (or single-process) runs the server
  startWorker();
}
