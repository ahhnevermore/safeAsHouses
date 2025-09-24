import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { ClientState } from "../../game/util.js";
import { playerDTO, selfDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";

export const PLAYER_COLOURS: number[] = [0xff7e00, 0xf6287d, 0xf9e400, 0x2cff05];
export const HUD_WIDTH: number = 560;
export const HUD_HEIGHT: number = 720;
export const BOARD_WIDTH: number = 720;
export const BOARD_HEIGHT: number = 720;

//Player name Boxes
const pb_Width = 120;
const pb_Height = 40;
const pb_Gap = 15;
const pb_MarginX = 20;
const pb_MarginY = 20;

export class GameState implements IState {
  container = new PIXI.Container();
  manager: StateManager;
  myTurn: boolean = false;
  duration: number = 0;
  activePlayerID: string = "";
  players: string[] = [];
  hud: PIXI.Container;
  playerList: playerDTO[] = [];
  selfState: selfDTO | null = null;
  activeHighlight: PIXI.Graphics;

  constructor(stateManager: StateManager) {
    this.manager = stateManager;

    // Board placeholder
    const board = new PIXI.Graphics()
      .rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
      .fill({ color: 0x228b22 });
    this.container.addChild(board);

    this.hud = new PIXI.Container();
    const hudBG = new PIXI.Graphics().rect(720, 0, HUD_WIDTH, HUD_HEIGHT).fill({ color: 0x1099bb });
    this.hud.addChild(hudBG);
    this.container.addChild(this.hud);

    this.activeHighlight = new PIXI.Graphics()
      .roundRect(0, 0, pb_Width, pb_Height, 8)
      .stroke({ color: 0x000000, width: 8 }); // black outline
    this.activeHighlight.y = pb_MarginY;
    this.hud.addChild(this.activeHighlight);

    // For demo: click HUD to trigger victory
    hudBG.eventMode = "static";
    hudBG.cursor = "pointer";
    hudBG.on("pointertap", () => {
      this.manager.changeState(ClientState.Victory);
    });

    //load assets
  }

  updateMyTurn(myTurn: boolean, publicID: string, duration: number) {
    this.myTurn = myTurn;
    this.duration = duration;
    this.activePlayerID = publicID;
    const activeIndex = this.playerList.findIndex((pl) => pl.id == publicID);

    this.activeHighlight.x = BOARD_WIDTH + pb_MarginX + activeIndex * (pb_Width + pb_Gap);
  }

  initializeGame(playerDTOs: playerDTO[], selfDTO: selfDTO) {
    this.playerList = playerDTOs;
    this.selfState = selfDTO;

    this.playerList.forEach((pl, i) => {
      pl.colour = PLAYER_COLOURS[i];
      const playerBox = new PIXI.Container();

      const bg = new PIXI.Graphics()
        .roundRect(0, 0, pb_Width, pb_Height, 8)
        .fill({ color: pl.colour });
      playerBox.addChild(bg);

      const label = new PIXI.Text(pl.name, {
        fill: 0xffffff,
        fontSize: 16,
        fontWeight: "bold",
      });
      label.anchor.set(0.5);
      label.x = pb_Width / 2;
      label.y = pb_Height / 2;
      playerBox.addChild(label);

      // Position inside HUD
      playerBox.x = BOARD_WIDTH + pb_MarginX + i * (pb_Width + pb_Gap); // offset inside HUD area
      playerBox.y = pb_MarginY;

      // playerBox.zIndex = 10;

      this.hud.addChild(playerBox);

      if (this.selfState) {
        if (pl.id == this.selfState?.id) {
          const sprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.crown));
          sprite.x = (4 * pb_Width) / 5;
          sprite.y = pb_Height / 2;
          sprite.scale.set(0.5);
          sprite.anchor.set(0.5);
          playerBox.addChild(sprite);
        }
      }
    });
  }

  enter() {}
  exit() {}
}
