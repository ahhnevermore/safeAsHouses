import * as PIXI from "pixi.js";
import { io, Socket } from "socket.io-client";
import { Board } from "../game/board.js"; // shared logic
import type { ClientEvents, ServerEvents } from "../game/util.js";

const url = import.meta.env.DEV
  ? "http://localhost:3000" // dev mode → point to your server
  : undefined; // prod mode → same origin

const socket: Socket<ServerEvents, ClientEvents> = io(url);
// PixiJS setup
const app = new PIXI.Application();
document.body.appendChild(app.view);

socket.on("connect", () => {
  console.log("Connected to server as:", socket.id);
  socket.emit("buyCard");
});
