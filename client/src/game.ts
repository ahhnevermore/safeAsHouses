import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { BASES, BOARD_SIZE, ClientState, TILE_COINS, Vec2 } from "../../game/util.js";
import { playerDTO, selfDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";
import { BoardTile } from "./boardTile.js";
import { UIButton } from "./uibutton.js";
import { suitShapeMap, UICard } from "./uicard.js";

const PLAYER_COLOURS: number[] = [0x05d9fa, 0xdde00d, 0xe902fa, 0xfa5502];
const HUD_WIDTH: number = 560;
const HUD_HEIGHT: number = 720;
const BOARD_WIDTH: number = 720;
const BOARD_HEIGHT: number = 720;
const BACKGROUND_ALPHA: number = 0.4;
const HUD_BACKGROUND: number = 0x134021;
const HUD_HIGHLIGHT: number = 0x4bfa82;
const HUD_INLAY: number = 0x164b27;
const HUD_INLAY2: number = 0x18532b;
const HUD_GREY: number = 0x383d3a;
const BTN_GREY: number = 0x626a65;
const CALL_BTN: number = 0xf5aa42;
const RAISE_BTN: number = 0xc41910;
const ALL_IN_BTN: number = 0x240302;
const MOVE_BTN: number = 0x085687;
const BUY_BTN: number = CALL_BTN;
const ADD_TILE_BTN: number = 0x44bf0b;
const SUBMIT_BTN: number = CALL_BTN;
const END_TURN_BTN: number = RAISE_BTN;

export const BTN_HEIGHT = 30;
export const BTN_WIDTH = 100;

const tdp_BoxWidth = 280;
const tdp_BoxHeight = 240;
const tdp_TagWidth = 30;
const tdp_HeaderHeight = 20;
const tdp_MarginY = 40;

const hdp_MarginY = 560;
const playerStatPrefix = "playerStat_";

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
  territory: Record<string, Set<string>> = {};
  handCards: UICard[] = [];

  playerTurnHighlight: PIXI.Graphics;
  statLabels: Record<string, PIXI.Text[]> = {};
  tiles: BoardTile[][] = [];
  tileDisplayContainer: PIXI.Container;
  handDisplayContainer: PIXI.Container;
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

    this.tiles = Array.from({ length: BOARD_SIZE }, (_, y) =>
      Array.from({ length: BOARD_SIZE }, (_, x) => {
        const tile = new BoardTile(x, y, TILE_SIZE);
        this.container.addChild(tile);

        // Listen for clicks directly
        tile.on("tileClicked", (t: BoardTile) => this.onTileClicked(t));

        return tile;
      })
    );

    const submitButton = new UIButton({
      text: "Submit Turn",
      color: SUBMIT_BTN,
    });
    submitButton.position.set(BOARD_WIDTH + HUD_WIDTH - 2 * BTN_WIDTH, 0);
    const endTurnButton = new UIButton({
      text: "Vote End",
      color: END_TURN_BTN,
    });
    endTurnButton.position.set(BOARD_WIDTH + HUD_WIDTH - BTN_WIDTH, 0);
    this.hud.addChild(submitButton, endTurnButton);

    this.tileDisplayContainer = new PIXI.Container();
    this.tileDisplayContainer.position.set(BOARD_WIDTH, tdp_MarginY);
    this.hud.addChild(this.tileDisplayContainer);

    this.handDisplayContainer = new PIXI.Container();
    this.handDisplayContainer.position.set(BOARD_WIDTH, hdp_MarginY);
    this.hud.addChild(this.handDisplayContainer);

    this.playerTurnHighlight = new PIXI.Graphics()
      .rect(0, 0, tdp_BoxWidth, tdp_HeaderHeight)
      .stroke({ color: HUD_HIGHLIGHT, width: 2 });
    this.hud.addChild(this.playerTurnHighlight);
  }

  onTileClicked(tile: BoardTile) {}

  updateMyTurn(myTurn: boolean, publicID: string, duration: number) {
    this.myTurn = myTurn;
    this.duration = duration;
    this.activePlayerID = publicID;
    const activeIndex = this.playerList.findIndex((pl) => pl.id == publicID);
    const col = activeIndex % 2;
    const row = Math.floor(activeIndex / 2);

    this.playerTurnHighlight.position.set(
      BOARD_WIDTH + col * tdp_BoxWidth,
      tdp_MarginY + row * tdp_BoxHeight
    );
  }

  initializeGame(playerDTOs: playerDTO[], selfDTO: selfDTO) {
    this.playerList = playerDTOs;
    this.selfState = selfDTO;
    this.setupTileDisplay();
    this.setupHandDisplay();
    this.setupPlayerBases();
    this.updateHandDisplay(selfDTO.hand);
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

  setupTileDisplay() {
    this.playerList.forEach((pl, i) => {
      pl.colour = PLAYER_COLOURS[i];
      const box = new PIXI.Container();
      const bg = new PIXI.Graphics()
        .rect(0, 0, tdp_BoxWidth, tdp_BoxHeight)
        .fill({ color: [1, 2].includes(i) ? HUD_INLAY : HUD_INLAY2 });
      box.addChild(bg);

      const header = new PIXI.Graphics()
        .rect(0, 0, tdp_TagWidth, tdp_HeaderHeight)
        .fill({ color: pl.colour ?? 0xffffff })
        .rect(tdp_TagWidth, 0, tdp_BoxWidth - tdp_TagWidth, tdp_HeaderHeight)
        .fill({ color: HUD_GREY });
      box.addChild(header);

      if (this.selfState) {
        if (pl.id == this.selfState?.id) {
          const sprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.crown));
          sprite.x = tdp_TagWidth / 2;
          sprite.y = tdp_HeaderHeight / 2;
          sprite.scale.set(0.009);
          sprite.anchor.set(0.5);
          header.addChild(sprite);
        }
      }

      const iconPaths = [ASSETS.cardsIcon, ASSETS.castleIcon, ASSETS.coinsIcon];
      const iconScales = [0.5, 0.5, 0.5];
      const iconYInc = [2, 2, 2];
      const iconX = [135, 180, 225];
      const labelX = [160, 205, 250];
      for (let i = 0; i < 3; i++) {
        const icon = new PIXI.Sprite(PIXI.Texture.from(iconPaths[i]));
        icon.scale.set(iconScales[i]);
        header.addChild(icon);
        icon.x = iconX[i];
        icon.y += iconYInc[i];

        const statLabel = new PIXI.Text({
          text: "0",
          style: {
            fill: 0xffffff,
            fontSize: 14,
            fontWeight: "bold",
          },
        });
        statLabel.x = labelX[i];
        statLabel.y = 10;
        statLabel.anchor.set(0, 0.5);
        statLabel.label = playerStatPrefix + i;
        if (!this.statLabels[pl.id]) {
          this.statLabels[pl.id] = [];
        }
        this.statLabels[pl.id].push(statLabel);
        header.addChild(statLabel);
      }

      this.updatePlayerHeader(i);

      const nameLabel = new PIXI.Text({
        text: pl.name,
        style: { fill: 0xffffff, fontSize: 12, fontWeight: "bold" },
      });
      nameLabel.x = tdp_TagWidth + 20;
      nameLabel.y = 3;
      box.addChild(nameLabel);

      // Position (2×2 grid)
      const col = i % 2;
      const row = Math.floor(i / 2);
      box.x = col * tdp_BoxWidth;
      box.y = row * tdp_BoxHeight;

      this.tileDisplayContainer.addChild(box);
      this.playerTileDisplays[pl.id] = box;
    });
    const moveBtn = new UIButton({ text: "Move", color: MOVE_BTN });
    moveBtn.position.set(0, 480);

    const callBtn = new UIButton({ text: "Call", color: CALL_BTN });
    callBtn.position.set(BTN_WIDTH, 480);

    const raiseBtn = new UIButton({ text: "Raise", color: RAISE_BTN });
    raiseBtn.position.set(2 * BTN_WIDTH, 480);

    const allInBtn = new UIButton({ text: "All In", color: ALL_IN_BTN });
    allInBtn.position.set(4 * BTN_WIDTH, 480);

    this.tileDisplayContainer.addChild(moveBtn, callBtn, raiseBtn, allInBtn);

    const tileLabel = new PIXI.Text({
      text: "0,0",
      style: { fill: 0xffffff, fontSize: 12, fontWeight: "bold" },
    });
  }

  updatePlayerHeader(selectedID: number) {
    const selectedPlayer = this.playerList[selectedID];

    const values = [
      selectedPlayer.handSize ?? 0,
      selectedPlayer.territory ?? 0,
      selectedPlayer.coins ?? 0,
    ];

    values.forEach((val, i) => {
      this.statLabels[selectedPlayer.id][i].text = String(val);
    });
  }

  setupHandDisplay() {
    const cardWidth = 78;
    const cardHeight = 120;
    const spacing = 12;
    const startX = (HUD_WIDTH - (cardWidth * 6 + spacing * 5)) / 2;

    for (let i = 0; i < 6; i++) {
      const card = new UICard(cardWidth, cardHeight);
      card.x = startX + i * (cardWidth + spacing);
      card.y = 0;
      this.handDisplayContainer.addChild(card);
      this.handCards.push(card);
    }

    // buttons
    const cardY = HUD_HEIGHT - hdp_MarginY - BTN_HEIGHT;
    const buyBtn = new UIButton({ text: "Buy Card", color: BUY_BTN });
    buyBtn.position.set(BTN_WIDTH, cardY);

    const addBtn = new UIButton({ text: "Add to Tile", color: ADD_TILE_BTN });
    addBtn.position.set(0, cardY);

    this.handDisplayContainer.addChild(buyBtn, addBtn);
  }

  updateHandDisplay(handKeys: Array<string | null>) {
    for (let i = 0; i < this.handCards.length; i++) {
      const displayCard = this.handCards[i];
      const key = handKeys[i];

      if (!key) {
        displayCard.hide();
        continue;
      }

      // deserialize
      const [suitStr = "0", rankStr = "0"] = key.split(",");
      const suit = parseInt(suitStr, 10);
      const rank = parseInt(rankStr, 10);

      // map suit to shape
      const shape = suitShapeMap[suit] ?? "circle";

      // show card
      displayCard.show(rank.toString(), shape);
    }
  }

  enter() {}
  exit() {}
}

function boardToWorld(x: number, y: number): [number, number] {
  return [x * (BOARD_WIDTH / BOARD_SIZE), y * (BOARD_HEIGHT / BOARD_SIZE)];
}
