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
import { saveRoomState, loadRoom, deleteRoom } from "./roomStateManager.js";
import { roomID } from "../game/types.js";

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: wFormat.combine(wFormat.timestamp(), wFormat.simple()),
  transports: [new wTransports.File({ filename: "app.log" }), new wTransports.Console()],
});

const app = express();
app.set("trust proxy", 1);
app.use(express.static("public"));

const server = createServer(app);
const io = new Server<ClientEvents, ServerEvents>(server, {
  cors: {
    origin: [],
    methods: ["GET", "POST"],
  },
});

async function startWorker() {
  logger.info(`Worker ${process.pid} starting...`);
  try {
    // --- Redis Connection ---
    const redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
    });
    redisClient.on("error", (err) => logger.error("Redis Client Error", err));
    await redisClient.connect();

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info(`Worker ${process.pid} connected to Redis and using adapter`);

    // --- Main Application Logic (Stateless) ---
    app.use(express.json());

    io.on("connection", (socket) => {
      // All game event handlers will follow the LOAD -> PROCESS -> SAVE pattern
      const withRoom = (handler: (room: Room, ...args: any[]) => Promise<void>) => {
        return async (roomId: roomID, ...args: any[]) => {
          try {
            const room = await loadRoom(redisClient as any, roomId, io, logger);
            if (room) {
              await handler(room, ...args);
              // Save the state after the handler has modified it
              await saveRoomState(redisClient as any, room);
            } else {
              logger.warn(`Room ${roomId} not found for event.`);
            }
          } catch (err) {
            logger.error(`Error processing event for room ${roomId}:`, err);
          }
        };
      };

      socket.on("joinGame", async () => {
        const username = socket.handshake.auth.username || "Guest";

        try {
          // Find or create a waiting room ID in Redis
          let waitingRoomId = await redisClient.get("waitingRoom");
          let room: Room | null = null;

          if (waitingRoomId) {
            // A waiting room exists, try to load it
            room = await loadRoom(redisClient as any, waitingRoomId as roomID, io, logger);
          }
          // If no room was found or loaded, create a new one
          if (!room) {
            const newRoomId = `room:${Date.now()}:${Math.random().toString(36).substring(2, 7)}` as roomID;
            const result = await redisClient.set("waitingRoom", newRoomId, { NX: true, EX: 60 });

            if (result) {
              waitingRoomId = newRoomId;
              logger.info(`Worker ${process.pid} created new waiting room: ${waitingRoomId}`);
            } else {
              // Another process created it, so let's get the definitive ID
              waitingRoomId = (await redisClient.get("waitingRoom"))! as roomID;

              if (!waitingRoomId) {
                logger.error("Failed to get waiting room ID after race condition.");
                return; // Cannot proceed
              }
            }
            // Create a fresh Room instance
            room = new Room(io, logger);
            room.id = waitingRoomId as roomID;
          }

          // We have a room object now, either new or loaded. Add the player.
          socket.join(room.id);
          room.addPlayer(socket, username); // This will emit joinGameAck
          logger.info(`Player ${socket.id} (${username}) joined room ${room.id}`);

          // Save the updated state back to Redis
          await saveRoomState(redisClient as any, room);

          // If the room is now full, start the game
          const MAX_PLAYERS = 4;
          if (room.isRoomFull()) {
            await redisClient.del("waitingRoom"); // It's no longer waiting
            logger.info(`Room ${room.id} is full, starting game...`);
            room.startGame();
            // Save final state after game starts
            await saveRoomState(redisClient as any, room);
            // TODO: Implement robust, event-driven cleanup when a game ends (e.g., on a 'winner' event)
            //       to delete the room state from Redis. The state will currently persist until the Redis key expires (24h).
          }
        } catch (err) {
          logger.error("Error during joinGame:", err);
        }
      });

      const handleSubmitTurn = async (room: Room) => {
        if (room.isPlayerTurn(socket.id)) {
          room.advanceTurn();
        }
      };
      socket.on("submitTurn", withRoom(handleSubmitTurn));

      // TODO: Refactor other game events (flip, placeCard, etc.) to use the withRoom handler
    });

    // --- Server Startup ---
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Worker ${process.pid} is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error(`Worker ${process.pid} failed to connect to Redis.`, err);
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
    logger.warn(`Worker ${worker.process.pid} exited (code=${code} signal=${signal}), restarting...`);
    cluster.fork();
  });
} else {
  // Worker (or single-process) runs the server
  startWorker();
}