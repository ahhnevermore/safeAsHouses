import * as PIXI from "pixi.js";
import { StateManager } from "./src/stateManager.js";
import { MainMenuState } from "./src/mainMenu.js";
import { VictoryState } from "./src/victory.js";
import { GameState } from "./src/game.js";
import { LobbyState } from "./src/lobby.js";
import { ServerEvents, ClientEvents } from "../game/events.js";
import { io, Socket } from "socket.io-client";
import { loadAssets } from "./src/loader.js";

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

  const socket: Socket<ServerEvents, ClientEvents> = io();
  socket.on("connect", () => {
    console.log("Connected as", socket.id);
  });
  await loadAssets();
  const stateManager = new StateManager(app, socket);
})();
