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
import { saveRoomState, loadRoom, serializeRoomState } from "./roomStateManager.js";
import { roomID, ID } from "../game/types.js";
import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import session from "express-session";
import { RedisStore } from "connect-redis";
import cookieParser from "cookie-parser";
import { MATCH_USER_LUA, USER_TO_ROOM_PREFIX, WAITING_ROOMS_ZSET } from "./lua-scripts.js";
import cors from "cors";
import {
  TimerManager,
  TURN_MAIN_PREFIX,
  TURN_ACTION_PREFIX,
  GAME_ABANDON_PREFIX,
} from "./timer.js";
import { deserializeRoomState } from "./roomStateManager.js";

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

const cleanupGame = async (
  redisClient: ReturnType<typeof createClient>,
  roomId: roomID,
  room: Room | null,
) => {
  const timerKeys = [
    `${TURN_MAIN_PREFIX}${roomId}`,
    `${TURN_ACTION_PREFIX}${roomId}`,
    `${GAME_ABANDON_PREFIX}${roomId}`,
  ];

  if (!room) {
    // If we don't have the room object, we can't get the players to clean up their mappings.
    // Just delete the main room key and timers.
    logger.warn(`Cleaning up room ${roomId} without full player data.`);
    await redisClient.del([roomId, ...timerKeys]);
    return;
  }
  logger.info(`Cleaning up game state for room ${roomId}...`);
  const playerKeys = room.players.map((p) => `${USER_TO_ROOM_PREFIX}${p.id}`);
  // Delete the main room state, all user->room mappings, and all timers in one go.
  await redisClient.del([roomId, ...playerKeys, ...timerKeys]);
  logger.info(`Cleanup complete for room ${roomId}.`);
};

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

    // Load Lua scripts and cache their SHAs for performance.
    const matchUserSha = await redisClient.scriptLoad(MATCH_USER_LUA);
    logger.info(`Cached MATCH_USER_LUA script with SHA: ${matchUserSha}`);

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info(`Worker ${process.pid} connected to Redis and using adapter`);

    const redisUrl = `redis://${process.env.REDIS_HOST || "localhost"}:${
      process.env.REDIS_PORT || 6379
    }`;
    // A worker process is a pure Executor.
    const timerManager = new TimerManager(redisUrl, logger, {
      isExecutor: true,
      isListener: false,
    });
    await timerManager.initialize();

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    // Give other workers a bit more time to create and persist the Room state
    // before we give up. This helps avoid race conditions during matchmaking.
    const waitAndLoadRoom = async (roomId: roomID, attempts = 20, delay = 100) => {
      for (let i = 0; i < attempts; i++) {
        const r = await loadRoom(redisClient as any, roomId, io, logger, timerManager);
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

      socket.on("disconnect", async () => {
        logger.info(`User ${userId} disconnected on socket ${socket.id}.`);
      });

      socket.on("joinGame", async (username: string) => {
        try {
          const userId = socket.data.userId;
          const MAX_PLAYERS = 4;
          const newRoomId = `room:${uuidv7()}`;

          const res = await redisClient.evalSha(matchUserSha, {
            keys: [WAITING_ROOMS_ZSET],
            arguments: [MAX_PLAYERS.toString(), userId, USER_TO_ROOM_PREFIX, newRoomId],
          });

          if (!res || !Array.isArray(res)) {
            logger.warn(`Invalid response from MATCH_USER_LUA for user ${userId}`);
            return;
          }

          const [matchType, roomId, ...rest] = res as [string, roomID, ...any[]];

          if (matchType === "RECONNECT") {
            const existingRoom = await loadRoom(
              redisClient as any,
              roomId,
              io,
              logger,
              timerManager,
            );
            if (existingRoom) {
              // The socket needs to join the room before receiving events.
              socket.join(roomId);

              logger.info(`User ${userId} reconnected to existing room ${existingRoom.id}`);
              // @ts-ignore - Touch the session to reset the expiration timer
              socket.request.session.touch();
              if (existingRoom.hasGameStarted()) {
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
            const newPlayerCount = parseInt(newPlayerCountStr, 10);
            let room: Room | null;
            logger.info(
              `MATCH response for user ${userId}: room=${roomId} players=${newPlayerCount}`,
            );

            if (newPlayerCount === 1) {
              room = new Room(io, logger, timerManager);
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
            const userToRoomKey = `${USER_TO_ROOM_PREFIX}${userId}`;
            const roomId = (await redisClient.get(userToRoomKey)) as roomID | null;
            if (roomId) {
              const roomData = await redisClient.get(roomId);
              if (!roomData) {
                await redisClient.del(userToRoomKey);
                logger.warn(
                  `User ${userId} had a stale room mapping for non-existent room ${roomId}. Deleted mapping.`,
                );
                return;
              }
              const room = deserializeRoomState(roomData, io, logger, timerManager);
              room.id = roomId;
              await handler(room, ...args);
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
          if (room.isPlayerTurn(socket.data.userId)) {
            const isGameOver = room.advanceTurn();
            if (isGameOver) {
              await cleanupGame(redisClient as any, room.id, room);
            } else {
              const serializedState = serializeRoomState(room);
              await timerManager.saveRoomBumpTurn(room.id, serializedState);
            }
          }
        }),
      );

      socket.on(
        "placeCard",
        withRoom(async (room, tileID, cardID) => {
          if (room.isPlayerTurn(socket.data.userId)) {
            const cardPlacedSuccessfully = room.placeCard(socket.data.userId, cardID, tileID);
            if (cardPlacedSuccessfully) {
              const serializedState = serializeRoomState(room);
              await timerManager.saveRoomBumpAction(room.id, serializedState);
            }
          }
        }),
      );
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Worker ${process.pid} is running on http://localhost:${PORT}`);
    });

    // Graceful shutdown logic for the worker
    const handleWorkerShutdown = async () => {
      logger.info(`Worker ${process.pid} starting graceful shutdown...`);

      // 1. Stop the server from accepting new connections and disconnect existing clients.
      io.close(() => {
        logger.info(`Socket.IO server closed in worker ${process.pid}.`);
      });

      // 2. Close the HTTP server.
      server.close(async () => {
        logger.info(`HTTP server closed in worker ${process.pid}.`);
        // 3. Disconnect from Redis.
        try {
          await redisClient.quit();
          logger.info(`Worker ${process.pid} disconnected from Redis.`);
        } catch (err) {
          logger.error(`Error quitting Redis in worker ${process.pid}:`, err);
        }
        // 4. Exit the process.
        process.exit(0);
      });

      // Failsafe timeout to force exit if shutdown hangs.
      setTimeout(() => {
        logger.warn(`Graceful shutdown timeout reached in worker ${process.pid}. Forcing exit.`);
        process.exit(1);
      }, 30000); // 30-second timeout
    };

    // Listen for shutdown messages from the primary process (in cluster mode)
    process.on("message", (msg) => {
      if (msg === "shutdown") {
        logger.info(`Worker ${process.pid} received shutdown message from primary.`);
        handleWorkerShutdown();
      }
    });

    // Also handle direct signals for single-process mode
    process.on("SIGINT", handleWorkerShutdown);
  } catch (err) {
    logger.error(`Worker ${process.pid} failed to start.`, err);
    process.exit(1);
  }
}

// Optionally run in cluster mode. Enable by setting `CLUSTER=true`.
const useCluster = process.env.CLUSTER === "true";

if (useCluster && cluster.isPrimary) {
  const workerCount = Number(process.env.WORKERS) || os.cpus().length;
  logger.info(`Primary ${process.pid} is running, forking ${workerCount} workers...`);

  const redisUrl = `redis://${process.env.REDIS_HOST || "localhost"}:${
    process.env.REDIS_PORT || 6379
  }`;
  // The primary process is both an Executor and a Listener.
  const timerManager = new TimerManager(redisUrl, logger, {
    isExecutor: true,
    isListener: true,
  });
  const redisClient = redisClientForStore.duplicate();

  // The primary process needs its own Socket.IO server instance with a Redis adapter
  // to be able to broadcast messages across the cluster.
  const primaryIo = new Server<ClientEvents, ServerEvents>();
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  (async () => {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    primaryIo.adapter(createAdapter(pubClient, subClient));

    await timerManager.initialize();
    await redisClient.connect();

    // The primary handles all timer expiration events.
    timerManager.on("turnTimerExpired", async (roomId: roomID) => {
      try {
        const room = await loadRoom(redisClient as any, roomId, primaryIo, logger, timerManager);
        if (room) {
          logger.info(`PRIMARY: Turn timer expired for room ${roomId}. Advancing turn.`);
          const isGameOver = room.advanceTurn();
          if (isGameOver) {
            await cleanupGame(redisClient as any, roomId, room);
          } else {
            const serializedState = serializeRoomState(room);
            await timerManager.saveRoomBumpTurn(room.id, serializedState);
          }
        } else {
          logger.warn(`PRIMARY: Timer expired for non-existent room ${roomId}.`);
        }
      } catch (err) {
        logger.error(`PRIMARY: Error processing turn timer expiration for room ${roomId}:`, err);
      }
    });

    timerManager.on("gameAbandonTimerExpired", async (roomId: roomID) => {
      logger.warn(`PRIMARY: Game ${roomId} abandoned due to inactivity. Cleaning up.`);
      const room = await loadRoom(redisClient as any, roomId, primaryIo, logger, timerManager);
      await cleanupGame(redisClient as any, roomId, room);
    });
  })();

  for (let i = 0; i < workerCount; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      `Worker ${worker.process.pid} exited (code=${code} signal=${signal}), restarting...`,
    );
    cluster.fork();
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, signaling workers to shut down.`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.send("shutdown");
    }
    await timerManager.close();
    await redisClient.quit();
    // Allow workers time to shut down before the primary process exits.
    setTimeout(() => {
      logger.info("Primary process exiting.");
      process.exit(0);
    }, 5000); // 5 seconds grace period
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
} else {
  // Worker (or single-process) runs the server
  startWorker();
}
