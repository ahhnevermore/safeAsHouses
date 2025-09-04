import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { ClientState } from "../../game/util.js";

export class VictoryState implements IState {
  container = new PIXI.Container();
  manager: StateManager;

  constructor(stateManger: StateManager) {
    this.manager = stateManger;
    const msg = new PIXI.Text({
      text: "Player 1 Wins!",
      style: { fill: 0xffff00, fontSize: 36 },
    });

    const button = new PIXI.Graphics().roundRect(0, 60, 250, 60, 15).fill({ color: 0x444444 });

    const btnText = new PIXI.Text({
      text: "Back to Menu",
      style: { fill: 0xffffff, fontSize: 20 },
    });
    btnText.x = 30;
    btnText.y = 75;

    button.eventMode = "static";
    button.cursor = "pointer";
    button.on("pointertap", () => {
      this.manager.changeState(ClientState.MainMenu);
    });

    this.container.addChild(msg, button, btnText);
    this.container.x = 400;
    this.container.y = 250;
  }

  enter() {}
  exit() {}
}
