import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { ClientState } from "../../game/util.js";

export enum MMSig {
  Join = "joinGame",
}
export class MainMenuState extends PIXI.EventEmitter implements IState {
  container = new PIXI.Container();

  constructor() {
    super();
    const introText = new PIXI.Text({
      text: "Safe As Houses",
      style: { fill: 0xffffff, fontSize: 24, fontFamily: "Courier" },
    });
    introText.y = -50;
    const button = new PIXI.Graphics().roundRect(0, 0, 200, 60, 15).fill({ color: 0x333333 });
    const text = new PIXI.Text({
      text: "Join Room",
      style: { fill: 0xffffff, fontSize: 20, fontFamily: "Courier" },
    });
    text.x = 50;
    text.y = 15;

    button.eventMode = "static";
    button.cursor = "pointer";
    button.on("pointertap", () => {
      this.emit(MMSig.Join);
    });

    this.container.addChild(button, text, introText);
    this.container.x = (1280 - 200) / 2; // adjust later for center
    this.container.y = (720 - 60) / 2;
  }

  enter(props?: Record<string, unknown>) {}
  exit() {}
}
