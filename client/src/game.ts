import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { ClientState, TILE_COINS } from "../../game/util.js";
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
const playerStatPrefix = "playerStat_";

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
  playerTurnHighlight: PIXI.Graphics;
  selectionHighlight: PIXI.Graphics;
  // inside GameState class
  statsDisplay: PIXI.Container;
  statLabels: PIXI.Text[] = [];

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

    this.selectionHighlight = new PIXI.Graphics()
      .roundRect(0, 0, pb_Width, pb_Height, 8)
      .stroke({ color: 0xadd8e6, width: 8 });
    this.selectionHighlight.y = pb_MarginY;
    this.hud.addChild(this.selectionHighlight);

    this.playerTurnHighlight = new PIXI.Graphics()
      .roundRect(0, 0, pb_Width, pb_Height, 8)
      .stroke({ color: 0x006423, width: 4 });
    this.playerTurnHighlight.y = pb_MarginY;
    this.hud.addChild(this.playerTurnHighlight);

    this.statsDisplay = new PIXI.Container();
    this.setupStatsDisplay();
  }

  setupStatsDisplay() {
    this.statsDisplay.x = BOARD_WIDTH + 2 * pb_MarginX;
    this.statsDisplay.y = pb_MarginY + pb_Height + 30; // below the boxes
    this.hud.addChild(this.statsDisplay);

    // Placeholder icons + labels for 4 stats
    const statSpacingX = 60;
    const iconSize = 32;

    const iconPaths = [ASSETS.cardsIcon, ASSETS.castleIcon, ASSETS.incomeIcon, ASSETS.coinsIcon];
    const iconScales = [0.7, 0.7, 1.0, 0.6];
    const iconYInc = [7, 7, 0, 10];
    for (let i = 0; i < 4; i++) {
      const icon = new PIXI.Sprite(PIXI.Texture.from(iconPaths[i]));
      icon.scale.set(iconScales[i]);
      this.statsDisplay.addChild(icon);
      icon.x = 2 * i * statSpacingX;
      icon.y += iconYInc[i];

      const label = new PIXI.Text({
        text: "0",
        style: {
          fill: 0xffffff,
          fontSize: 18,
          fontWeight: "bold",
        },
      });
      label.x = 2 * i * statSpacingX + 1.5 * iconSize;
      label.y = 20;
      label.anchor.set(0, 0.5);
      label.label = playerStatPrefix + i;
      this.statsDisplay.addChild(icon);
      this.statsDisplay.addChild(label);
      this.statLabels.push(label);
    }
  }

  updateMyTurn(myTurn: boolean, publicID: string, duration: number) {
    this.myTurn = myTurn;
    this.duration = duration;
    this.activePlayerID = publicID;
    const activeIndex = this.playerList.findIndex((pl) => pl.id == publicID);

    this.playerTurnHighlight.x = BOARD_WIDTH + pb_MarginX + activeIndex * (pb_Width + pb_Gap);
  }

  initializeGame(playerDTOs: playerDTO[], selfDTO: selfDTO) {
    this.playerList = playerDTOs;
    this.selfState = selfDTO;
    this.setupPlayerBoxes();
  }

  updatePlayerSelect(selectedID: number) {
    this.selectionHighlight.position.x =
      BOARD_WIDTH + pb_MarginX + selectedID * (pb_Width + pb_Gap);

    const selectedPlayer = this.playerList[selectedID];

    const values = [
      selectedPlayer.handSize ?? 0,
      selectedPlayer.territory ?? 0,
      (selectedPlayer.territory ?? 0) * TILE_COINS,
      selectedPlayer.coins ?? 0,
    ];

    values.forEach((val, i) => {
      this.statLabels[i].text = String(val);
    });
  }

  setupPlayerBoxes() {
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
      playerBox.interactive = true;
      playerBox.cursor = "pointer";

      playerBox.on("pointertap", () => {
        this.updatePlayerSelect(i);
      });
      playerBox.on("pointerover", () => {
        bg.tint = 0xdddddd; // brighten
      });
      playerBox.on("pointerout", () => {
        bg.tint = 0xffffff; // reset
      });
      playerBox.on("pointerdown", () => {
        bg.scale.set(0.95); // press effect
      });
      playerBox.on("pointerup", () => {
        bg.scale.set(1); // release
      });

      this.hud.addChild(playerBox);

      if (this.selfState) {
        if (pl.id == this.selfState?.id) {
          const sprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.crown));
          sprite.x = (6 * pb_Width) / 7;
          sprite.y = pb_Height / 2;
          sprite.scale.set(0.009);
          sprite.anchor.set(0.5);
          playerBox.addChild(sprite);
          this.updatePlayerSelect(i);
        }
      }
    });
  }

  enter() {}
  exit() {}
}
