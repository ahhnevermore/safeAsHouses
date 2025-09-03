import { createLogger, format as wFormat, transports as wTransports } from "winston";
import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { Room } from "../game/room.js";
import type { ClientEvents, ServerEvents } from "../game/util.js";

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
    origin: "http://localhost:5173", // your client dev port
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

let rooms: Record<string, Room> = {};
let waitingRoom: Room | null = null;

io.on("connection", (socket) => {
  const username = socket.handshake.auth.username || "Guest";

  if (!waitingRoom) {
    const newRoom = new Room(io, logger);
    newRoom.on("windup", () => {
      delete rooms[newRoom.id];
    });
    waitingRoom = newRoom;
  }
  waitingRoom.addPlayer(socket, username);
  if (waitingRoom.isRoomFull()) {
    waitingRoom.startGame();
    rooms[waitingRoom.id] = waitingRoom;
    waitingRoom = null;
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Game server is running on http://localhost:${PORT}`);
});
