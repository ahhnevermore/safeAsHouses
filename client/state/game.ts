import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { ClientState } from "../../game/util.js";

export class GameState implements IState {
  container = new PIXI.Container();
  manager: StateManager;
  myTurn: boolean = false;
  duration: number = 0;
  activeIndex: number = 0;
  players: string[] = [];

  constructor(stateManager: StateManager) {
    this.manager = stateManager;

    // Board placeholder
    const board = new PIXI.Graphics().rect(0, 0, 720, 720).fill({ color: 0x228b22 });
    this.container.addChild(board);

    // HUD placeholder
    const hud = new PIXI.Graphics().rect(720, 0, 560, 720).fill({ color: 0x1099bb });
    this.container.addChild(hud);

    // For demo: click HUD to trigger victory
    hud.eventMode = "static";
    hud.cursor = "pointer";
    hud.on("pointertap", () => {
      this.manager.changeState(ClientState.Victory);
    });
  }

  updateMyTurn(myTurn: boolean, playerIndex: number, duration: number) {
    this.myTurn = myTurn;
    this.duration = duration;
    this.activeIndex = playerIndex;
  }
  enter() {}
  exit() {}
}
