import * as PIXI from "pixi.js";
import { StateManager } from "./src/stateManager.js";
import { MainMenuState } from "./src/mainMenu.js";
import { VictoryState } from "./src/victory.js";
import { GameState } from "./src/game.js";
import { LobbyState } from "./src/lobby.js";
import { ServerEvents, ClientEvents } from "../game/events.js";
import { io, Socket } from "socket.io-client";
import { loadAssets } from "./src/loader.js";

/**
 * Ensures the user has a session cookie by calling the auth endpoint.
 * This is called before the socket connects.
 */
async function ensureSession(): Promise<void> {
  try {
    await fetch("/auth/guest", { credentials: "include" });
  } catch (error) {
    console.error("Failed to establish session:", error);
  }
}

(async () => {
  const DESIGN_WIDTH = 1280;
  const DESIGN_HEIGHT = 720;
  const app = new PIXI.Application();
  await app.init({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: 0x222222,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  await loadAssets();

  await ensureSession();

  const socket: Socket<ServerEvents, ClientEvents> = io({
    transports: ["websocket"],
    withCredentials: true,
  });
  socket.on("connect", () => {
    console.log("Connected to server with socket ID:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Connection failed:", err.message);
  });

  const stateManager = new StateManager(app, socket);
})();
