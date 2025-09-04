import * as PIXI from "pixi.js";
import { StateManager } from "./state/stateManager.js";
import { MainMenuState } from "./state/mainMenu.js";
import { VictoryState } from "./state/victory.js";
import { GameState } from "./state/game.js";
import { LobbyState } from "./state/lobby.js";
import { ServerEvents, ClientEvents } from "../game/util.js";
import { io, Socket } from "socket.io-client";

(async () => {
  const DESIGN_WIDTH = 1280;
  const DESIGN_HEIGHT = 720;
  const app = new PIXI.Application();
  await app.init({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: 0x222222,
  });

  document.body.appendChild(app.canvas);

  const socket: Socket<ServerEvents, ClientEvents> = io();
  socket.on("connect", () => {
    console.log("Connected as", socket.id);
  });
  const stateManager = new StateManager(app, socket);
})();
