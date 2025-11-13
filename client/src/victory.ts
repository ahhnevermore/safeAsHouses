import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { ClientState } from "../../game/util.js";

export enum VSig {
  Back = "backToMenu",
}

export class VictoryState extends PIXI.EventEmitter implements IState {
  container = new PIXI.Container();

  constructor() {
    super();
    const msg = new PIXI.Text({
      text: "Player 1 Wins!",
      style: { fill: 0xffff00, fontSize: 36, fontFamily: "Courier" },
    });

    const button = new PIXI.Graphics().roundRect(0, 60, 250, 60, 15).fill({ color: 0x444444 });

    const btnText = new PIXI.Text({
      text: "Back to Menu",
      style: { fill: 0xffffff, fontSize: 20, fontFamily: "Courier" },
    });
    btnText.x = 30;
    btnText.y = 75;

    button.eventMode = "static";
    button.cursor = "pointer";
    button.on("pointertap", () => {
      this.emit(VSig.Back);
    });

    this.container.addChild(msg, button, btnText);
    this.container.x = 400;
    this.container.y = 250;
  }

  enter() {}
  exit() {}
}
