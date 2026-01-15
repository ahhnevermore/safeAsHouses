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
    const redisClient = createClient({ url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}` });
    redisClient.on('error', err => logger.error('Redis Client Error', err));
    await redisClient.connect();

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info(`Worker ${process.pid} connected to Redis and using adapter`);

    // --- Main Application Logic ---
    app.use(express.json());
    
    // Store active Room instances
    const rooms = new Map<string, Room>();

    io.on("connection", (socket) => {
      socket.on("joinGame", async () => {
        const username = socket.handshake.auth.username || "Guest";

        try {
          // Find or create a waiting room ID in Redis
          let waitingRoomId = await redisClient.get("waitingRoom");

          if (!waitingRoomId) {
            // No waiting room, let's create one.
            const newRoomId = `room:${Date.now()}:${Math.random().toString(36).substring(2, 7)}`;
            const result = await redisClient.set("waitingRoom", newRoomId, { NX: true, EX: 60 });

            if (result) {
              waitingRoomId = newRoomId;
              logger.info(`Worker ${process.pid} created new waiting room: ${waitingRoomId}`);
            } else {
              // Another process created the room. Get the new ID.
              waitingRoomId = await redisClient.get("waitingRoom");
              if (!waitingRoomId) {
                logger.error("Could not get or create a waiting room.");
                return;
              }
            }
          }

          // Add the player socket to the room's broadcast group
          socket.join(waitingRoomId);
          logger.info(`Player ${socket.id} (${username}) joined waiting room ${waitingRoomId}`);

          // Get or create a Room instance for this waiting room
          if (!rooms.has(waitingRoomId)) {
            const newRoom = new Room(io, logger);
            newRoom.id = waitingRoomId;
            rooms.set(waitingRoomId, newRoom);
            logger.info(`Created Room instance for ${waitingRoomId}`);
          }

          const room = rooms.get(waitingRoomId)!;
          room.addPlayer(socket, username);

          // Check if room is full
          const MAX_PLAYERS = 4;
          if (room.isRoomFull()) {
            await redisClient.del("waitingRoom");
            logger.info(`Room ${waitingRoomId} is full, starting game...`);
            room.startGame();
            // Clean up the room after some time (or when game ends)
            setTimeout(() => {
              rooms.delete(waitingRoomId);
              logger.info(`Cleaned up room ${waitingRoomId}`);
            }, 300000); // 5 minutes
          }

        } catch (err) {
          logger.error("Error during joinGame:", err);
        }
      });
    });

    // --- Server Startup ---
    // The primary process will open the port, and workers will share it.
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