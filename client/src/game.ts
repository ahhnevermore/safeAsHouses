import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { BASES, BOARD_SIZE, ClientState, TILE_COINS, Vec2 } from "../../game/util.js";
import { playerDTO, selfDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";
import { BoardTile } from "./boardTile.js";

export const PLAYER_COLOURS: number[] = [0x05d9fa, 0xdde00d, 0xe902fa, 0xfa5502];
export const HUD_WIDTH: number = 560;
export const HUD_HEIGHT: number = 720;
export const BOARD_WIDTH: number = 720;
export const BOARD_HEIGHT: number = 720;
export const BASE_TILE_ALPHA: number = 0.5;
export const OVERLAY_TILE_ALPHA: number = 0.7;
export const BACKGROUND_ALPHA: number = 0.4;
export const HUD_BACKGROUND: number = 0x134021;
export const HUD_HIGHLIGHT: number = 0x4bfa82;
export const HUD_INLAY: number = 0x164b27;
export const HUD_INLAY2: number = 0x18532b;
export const HUD_GREY: number = 0x383d3a;
export const BTN_GREY: number = 0x626a65;
export const BUY_BTN: number = 0xc4ab08;
export const ADD_TILE_BTN: number = 0x44bf0b;
export const CALL_BTN: number = 0x085687;
export const RAISE_BTN: number = 0xc41910;
export const ALL_IN_BTN: number = 0x240302;
export const SUBMIT_BTN: number = BUY_BTN;
export const END_TURN_BTN: number = ADD_TILE_BTN;

//Player name Boxes
const pb_Width = 120;
const pb_Height = 40;
const pb_Gap = 15;
const pb_MarginX = 20;
const pb_MarginY = 20;
const playerStatPrefix = "playerStat_";

const tdp_MarginY = 30;

const TILE_SIZE = BOARD_WIDTH / BOARD_SIZE;
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

  tiles: BoardTile[][] = [];
  territory: Record<string, Set<string>> = {};

  tileDisplayContainer: PIXI.Container;
  handContainer: PIXI.Container;
  playerTileDisplays: Record<string, PIXI.Container> = {};

  constructor(stateManager: StateManager) {
    this.manager = stateManager;

    // Board placeholder
    const board = new PIXI.Sprite(PIXI.Texture.from(ASSETS.gameBoard));
    this.container.addChild(board);
    board.alpha = BACKGROUND_ALPHA;

    this.hud = new PIXI.Container();
    const hudBG = new PIXI.Graphics()
      .rect(720, 0, HUD_WIDTH, HUD_HEIGHT)
      .fill({ color: HUD_BACKGROUND });
    this.hud.addChild(hudBG);
    this.container.addChild(this.hud);

    this.selectionHighlight = new PIXI.Graphics()
      .rect(0, 0, pb_Width, pb_Height)
      .stroke({ color: 0xadd8e6, width: 8 });
    this.selectionHighlight.y = pb_MarginY;
    this.hud.addChild(this.selectionHighlight);

    this.playerTurnHighlight = new PIXI.Graphics()
      .rect(0, 0, pb_Width, pb_Height)
      .stroke({ color: HUD_HIGHLIGHT, width: 4 });
    this.playerTurnHighlight.y = pb_MarginY;
    this.hud.addChild(this.playerTurnHighlight);
    this.statsDisplay = new PIXI.Container();
    this.setupStatsDisplay();
    this.tiles = Array.from({ length: BOARD_SIZE }, (_, y) =>
      Array.from({ length: BOARD_SIZE }, (_, x) => {
        const tile = new BoardTile(x, y, TILE_SIZE);
        this.container.addChild(tile);

        // Listen for clicks directly
        tile.on("tileClicked", (t: BoardTile) => this.onTileClicked(t));

        return tile;
      })
    );

    this.tileDisplayContainer = new PIXI.Container();
    this.tileDisplayContainer.position.set(BOARD_WIDTH, 240);
    this.hud.addChild(this.tileDisplayContainer);

    this.handContainer = new PIXI.Container();
    this.handContainer.position.set(BOARD_WIDTH, 540);
    this.hud.addChild(this.handContainer);
  }

  onTileClicked(tile: BoardTile) {}
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
    this.setupPlayerBases();
    this.setupTileDisplay();
    this.setupHandDisplay();
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

  setupPlayerBases() {
    this.playerList.forEach((pl, i) => {
      const tileVec = Vec2.fromKey(BASES[i]);
      this.territory[pl.id] = new Set<string>();
      this.territory[pl.id].add(BASES[i]);
      this.tiles[tileVec.x][tileVec.y].setColor(pl.colour ?? 0xfffff);
      const baseSprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.castleIcon));
      this.container.addChild(baseSprite);
      [baseSprite.x, baseSprite.y] = boardToWorld(tileVec.x, tileVec.y);
      baseSprite.x += 25;
      baseSprite.y += 25;
      baseSprite.alpha = BACKGROUND_ALPHA;
    });
  }

  setupPlayerBoxes() {
    this.playerList.forEach((pl, i) => {
      pl.colour = PLAYER_COLOURS[i];
      const playerBox = new PIXI.Container();

      const bg = new PIXI.Graphics()
        .rect(0, 0, pb_Width / 4, pb_Height)
        .fill({ color: pl.colour })
        .rect(pb_Width / 4, 0, pb_Width * 0.75, pb_Height)
        .fill({ color: HUD_GREY });

      playerBox.addChild(bg);

      const label = new PIXI.Text(pl.name, {
        fill: 0xffffff,
        fontSize: 13,
        fontWeight: "bold",
      });
      label.anchor.set(0.5);
      label.x = pb_Width * 0.25 + pb_Width * 0.375;
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
          sprite.x = (7 * pb_Width) / 8;
          sprite.y = pb_Height / 2;
          sprite.scale.set(0.009);
          sprite.anchor.set(0.5);
          playerBox.addChild(sprite);
          this.updatePlayerSelect(i);
        }
      }
    });
  }

  setupTileDisplay() {
    const boxWidth = 280;
    const boxHeight = 140;
    const tagWidth = 30;

    this.playerList.forEach((pl, i) => {
      const box = new PIXI.Container();
      const bg = new PIXI.Graphics()
        .rect(0, 0, boxWidth, boxHeight)
        .fill({ color: [1, 2].includes(i) ? HUD_INLAY : HUD_INLAY2 });
      box.addChild(bg);

      const header = new PIXI.Graphics()
        .rect(0, 0, tagWidth, 20)
        .fill({ color: pl.colour ?? 0xffffff })
        .rect(tagWidth, 0, boxWidth - tagWidth, 20)
        .fill({ color: HUD_GREY });
      box.addChild(header);

      const iconPaths = [ASSETS.cardsIcon, ASSETS.castleIcon, ASSETS.incomeIcon, ASSETS.coinsIcon];
      const iconScales = [0.7, 0.7, 1.0, 0.6];
      const iconYInc = [7, 7, 0, 10];
      const iconX = [10, 100, 190, 280];
      const labelX = [50, 140, 230, 310];
      for (let i = 0; i < 4; i++) {
        const icon = new PIXI.Sprite(PIXI.Texture.from(iconPaths[i]));
        icon.scale.set(iconScales[i]);
        header.addChild(icon);
        icon.x = iconX[i];
        icon.y += iconYInc[i];

        const statLabel = new PIXI.Text({
          text: "0",
          style: {
            fill: 0xffffff,
            fontSize: 18,
            fontWeight: "bold",
          },
        });
        statLabel.x = labelX[i];
        statLabel.y = 20;
        statLabel.anchor.set(0, 0.5);
        statLabel.label = playerStatPrefix + i;
        header.addChild(statLabel);
      }

      const nameLabel = new PIXI.Text({
        text: pl.name,
        style: { fill: 0xffffff, fontSize: 12, fontWeight: "bold" },
      });
      nameLabel.x = tagWidth + 20;
      nameLabel.y = 3;
      box.addChild(nameLabel);

      // Position (2×2 grid)
      const col = i % 2;
      const row = Math.floor(i / 2);
      box.x = col * boxWidth;
      box.y = row * boxHeight;

      const callBtn = this.makeButton("Call", 152.5, 280, CALL_BTN);
      const raiseBtn = this.makeButton("Raise", 237.5, 280, RAISE_BTN);
      const allInBtn = this.makeButton("All In", 322.5, 280, ALL_IN_BTN);
      this.tileDisplayContainer.addChild(callBtn, raiseBtn, allInBtn);

      const tileLabel = new PIXI.Text({
        text: "0,0",
        style: { fill: 0xffffff, fontSize: 12, fontWeight: "bold" },
      });

      this.tileDisplayContainer.addChild(box);
      this.playerTileDisplays[pl.id] = box;
    });
  }

  setupHandDisplay() {
    const cardWidth = 75;
    const cardHeight = 105;
    const spacing = 15;
    const startX = (HUD_WIDTH - (cardWidth * 6 + spacing * 5)) / 2;

    for (let i = 0; i < 6; i++) {
      const card = new PIXI.Graphics()
        .roundRect(0, 0, cardWidth, cardHeight, 8)
        .fill({ color: 0xffffff, alpha: 0.2 })
        .stroke({ color: 0xffffff, width: 2 });
      card.x = startX + i * (cardWidth + spacing);
      card.y = 0;
      this.handContainer.addChild(card);
    }

    // Buttons
    const buyBtn = this.makeButton("Buy Card", 160, 120, 0x007bff);
    const addBtn = this.makeButton("Add to Tile", 300, 120, 0x00cc44);

    this.handContainer.addChild(buyBtn, addBtn);
  }

  makeButton(label: string, x: number, y: number, color: number): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics().rect(0, 0, 85, 30).fill({ color });
    const txt = new PIXI.Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 14, fontWeight: "bold" },
    });
    txt.anchor.set(0.5);
    txt.x = 42.5;
    txt.y = 15;
    btn.addChild(bg, txt);
    btn.position.set(x, y);
    btn.interactive = true;
    btn.cursor = "pointer";
    return btn;
  }

  enter() {}
  exit() {}
}

function boardToWorld(x: number, y: number): [number, number] {
  return [x * (BOARD_WIDTH / BOARD_SIZE), y * (BOARD_HEIGHT / BOARD_SIZE)];
}
