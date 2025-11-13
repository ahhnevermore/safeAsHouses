import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { PLAYER_COUNT } from "../../game/util.js";

export class LobbyState extends PIXI.EventEmitter implements IState {
  container = new PIXI.Container();
  private text: PIXI.Text;

  constructor() {
    super();
    this.text = new PIXI.Text({
      text: "Waiting for players: 1/2",
      style: { fill: 0xffffff, fontSize: 24, fontFamily: "Courier" },
    });

    this.container.addChild(this.text);
    this.container.x = 400;
    this.container.y = 200;
  }

  setPlayers(num: number) {
    this.text.text = `Waiting for players: ${num}/${PLAYER_COUNT}`;
  }

  enter(props?: Record<string, unknown>) {
    this.setPlayers(props?.actPlayers as number);
  }
  exit() {}
}
