import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";

export class LobbyState implements IState {
  container = new PIXI.Container();
  private text: PIXI.Text;
  manager: StateManager;

  constructor(stateManager: StateManager) {
    this.manager = stateManager;
    this.text = new PIXI.Text({
      text: "Waiting for players: 1/2",
      style: { fill: 0xffffff, fontSize: 24 },
    });

    this.container.addChild(this.text);
    this.container.x = 400;
    this.container.y = 200;
  }

  setPlayers(num: number) {
    this.text.text = `Waiting for players: ${num} /4`;
  }

  enter(props?: Record<string, unknown>) {
    this.setPlayers(props?.currentPlayers as number);
  }
  exit() {}
}
