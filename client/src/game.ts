import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import { BASES, BOARD_SIZE, Card, ClientState, TILE_COINS, Vec2 } from "../../game/util.js";
import { playerDTO, selfDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";
import { BoardTile, Layer } from "./boardTile.js";
import { UIButton } from "./uibutton.js";
import { UICard } from "./uicard.js";
import { cardID, colour, publicID } from "../../game/types.js";

enum ActiveAction {
  None = 0,
  Select = 1,
  Move = 2,
}

const PLAYER_COLOURS: colour[] = [
  0x05d9fa as colour,
  0xdde00d as colour,
  0xe902fa as colour,
  0xfa5502 as colour,
];
const HUD_WIDTH: number = 560;
const HUD_HEIGHT: number = 720;
const BOARD_WIDTH: number = 720;
const BOARD_HEIGHT: number = 720;
const BACKGROUND_ALPHA: number = 0.4;
const HUD_BACKGROUND: colour = 0x134021 as colour;
const HUD_HIGHLIGHT: colour = 0x4bfa82 as colour;
const HUD_INLAY: colour = 0x164b27 as colour;
const HUD_INLAY2: colour = 0x18532b as colour;
const HUD_GREY: colour = 0x383d3a as colour;
const BTN_GREY: colour = 0x626a65 as colour;
const CALL_BTN: colour = 0xf5aa42 as colour;
const RAISE_BTN: colour = 0xc41910 as colour;
const ALL_IN_BTN: colour = 0x240302 as colour;
const MOVE_BTN: colour = 0x085687 as colour;
const BUY_BTN: colour = CALL_BTN;
const ADD_TILE_BTN: colour = 0x44bf0b as colour;
const SUBMIT_BTN: colour = CALL_BTN;
const END_TURN_BTN: colour = RAISE_BTN;

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
  manager: StateManager;
  container = new PIXI.Container();
  hud: PIXI.Container;
  tileDisplayContainer: PIXI.Container;
  handDisplayContainer: PIXI.Container;

  model: {
    myTurn: boolean;
    timeLeft: number;
    actPlayerID: publicID;
    players: playerDTO[];
    self: selfDTO | null;
    territory: Partial<Record<publicID, Set<string>>>;
    actAction: ActiveAction;
  } = {
    myTurn: false,
    timeLeft: 0,
    actPlayerID: "" as publicID,
    players: [],
    self: null,
    territory: {},
    actAction: ActiveAction.None,
  };

  mainUI: {
    tiles: BoardTile[][];
    playerHighlight: PIXI.Graphics | null;
    selTile: BoardTile | null;
  } = { tiles: [], selTile: null, playerHighlight: null };

  handUI: {
    cards: UICard[];
  } = { cards: [] };

  tileUI: {
    stats: Record<string, PIXI.Text[]>;
    actTile: PIXI.Text | null;
    playerDisplays: Partial<Record<string, PIXI.Container>>;
  } = { stats: {}, actTile: null, playerDisplays: {} };

  constructor(stateManager: StateManager) {
    this.manager = stateManager;

    const board = new PIXI.Sprite(PIXI.Texture.from(ASSETS.gameBoard));
    this.container.addChild(board);
    board.alpha = BACKGROUND_ALPHA;

    this.hud = new PIXI.Container();
    const hudBG = new PIXI.Graphics()
      .rect(720, 0, HUD_WIDTH, HUD_HEIGHT)
      .fill({ color: HUD_BACKGROUND });
    this.hud.addChild(hudBG);
    this.container.addChild(this.hud);

    this.mainUI.tiles = Array.from({ length: BOARD_SIZE }, (_, y) =>
      Array.from({ length: BOARD_SIZE }, (_, x) => {
        const tile = new BoardTile(x, y, TILE_SIZE);
        this.container.addChild(tile);

        // Listen for clicks directly
        tile.on("clicked", (t: BoardTile) => this.onTileClicked(t));

        return tile;
      })
    );

    const submitButton = new UIButton({
      text: "Submit Turn",
      colour: SUBMIT_BTN,
    });
    submitButton.position.set(BOARD_WIDTH + HUD_WIDTH - 2 * BTN_WIDTH, 0);
    const endTurnButton = new UIButton({
      text: "Vote End",
      colour: END_TURN_BTN,
    });
    endTurnButton.position.set(BOARD_WIDTH + HUD_WIDTH - BTN_WIDTH, 0);
    this.hud.addChild(submitButton, endTurnButton);

    this.tileDisplayContainer = new PIXI.Container();
    this.tileDisplayContainer.position.set(BOARD_WIDTH, tdp_MarginY);
    this.hud.addChild(this.tileDisplayContainer);

    this.handDisplayContainer = new PIXI.Container();
    this.handDisplayContainer.position.set(BOARD_WIDTH, hdp_MarginY);
    this.hud.addChild(this.handDisplayContainer);

    this.mainUI.playerHighlight = new PIXI.Graphics()
      .rect(0, 0, tdp_BoxWidth, tdp_HeaderHeight)
      .stroke({ color: HUD_HIGHLIGHT, width: 2 });
    this.hud.addChild(this.mainUI.playerHighlight);
  }

  onTileClicked(tile: BoardTile) {
    switch (this.model.actAction) {
      default: {
        if (this.mainUI.selTile) {
          this.mainUI.selTile.clearLayer(Layer.Select);
        }
        this.mainUI.selTile = tile;
        this.mainUI.selTile.setLayer(Layer.Select);
        if (this.tileUI.actTile) {
          this.tileUI.actTile.text = `${tile.xIndex},${tile.yIndex}`;
        }
      }
    }
  }

  updateMyTurn(myTurn: boolean, publicID: publicID, duration: number) {
    this.model.myTurn = myTurn;
    this.model.timeLeft = duration;
    this.model.actPlayerID = publicID;
    const actIndex = this.model.players.findIndex((pl) => pl.id == publicID);
    const col = actIndex % 2;
    const row = Math.floor(actIndex / 2);

    this.mainUI.playerHighlight?.position.set(
      BOARD_WIDTH + col * tdp_BoxWidth,
      tdp_MarginY + row * tdp_BoxHeight
    );
  }

  initializeGame(playerDTOs: playerDTO[], selfDTO: selfDTO) {
    this.model.players = playerDTOs;
    this.model.self = selfDTO;
    this.setupTileDisplay();
    this.setupHandDisplay();
    this.setupPlayerBases();
    this.updateHandDisplay(selfDTO.hand);
    this.onTileClicked(this.mainUI.tiles[0][0]);
  }

  setupPlayerBases() {
    this.model.players.forEach((pl, i) => {
      const tileVec = Vec2.fromKey(BASES[i]);
      this.model.territory[pl.id] = new Set<string>([BASES[i]]);
      this.mainUI.tiles[tileVec.x][tileVec.y].setLayer(Layer.Base, pl.colour);
      const baseSprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.castleIcon));
      this.container.addChild(baseSprite);
      [baseSprite.x, baseSprite.y] = boardToWorld(tileVec.x, tileVec.y);
      baseSprite.x += 25;
      baseSprite.y += 25;
      baseSprite.alpha = BACKGROUND_ALPHA;
    });
  }

  setupTileDisplay() {
    this.model.players.forEach((pl, i) => {
      pl.colour = PLAYER_COLOURS[i];
      const box = new PIXI.Container();
      const bg = new PIXI.Graphics()
        .rect(0, 0, tdp_BoxWidth, tdp_BoxHeight)
        .fill({ color: [1, 2].includes(i) ? HUD_INLAY : HUD_INLAY2 });
      box.addChild(bg);

      const header = this.createPlayerHeader(pl);
      box.addChild(header);
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
      this.tileUI.playerDisplays[pl.id] = box;
    });
    const moveBtn = new UIButton({ text: "Move", colour: MOVE_BTN });
    moveBtn.position.set(0, 480);

    const callBtn = new UIButton({ text: "Call", colour: CALL_BTN });
    callBtn.position.set(BTN_WIDTH, 480);

    const raiseBtn = new UIButton({ text: "Raise", colour: RAISE_BTN });
    raiseBtn.position.set(2 * BTN_WIDTH, 480);

    const allInBtn = new UIButton({ text: "All In", colour: ALL_IN_BTN });
    allInBtn.position.set(4 * BTN_WIDTH, 480);

    this.tileUI.actTile = new PIXI.Text({
      text: "0,0",
      style: { fill: 0xffffff, fontSize: 18, fontWeight: "bold" },
    });
    this.tileUI.actTile.position.set(10, -30);

    this.tileDisplayContainer.addChild(moveBtn, callBtn, raiseBtn, allInBtn, this.tileUI.actTile);
  }

  createPlayerHeader(pl: playerDTO): PIXI.Graphics {
    const header = new PIXI.Graphics()
      .rect(0, 0, tdp_TagWidth, tdp_HeaderHeight)
      .fill({ color: pl.colour ?? 0xffffff })
      .rect(tdp_TagWidth, 0, tdp_BoxWidth - tdp_TagWidth, tdp_HeaderHeight)
      .fill({ color: HUD_GREY });

    if (this.model.self) {
      if (pl.id == this.model.self.id) {
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
      if (!this.tileUI.stats[pl.id]) {
        this.tileUI.stats[pl.id] = [];
      }
      this.tileUI.stats[pl.id].push(statLabel);
      header.addChild(statLabel);
    }
    return header;
  }
  updatePlayerHeader(selID: number) {
    const selPlayer = this.model.players[selID];

    const values = [selPlayer.handSize ?? 0, selPlayer.territory ?? 0, selPlayer.coins ?? 0];

    values.forEach((val, i) => {
      this.tileUI.stats[selPlayer.id][i].text = String(val);
    });
  }

  setupHandDisplay() {
    const cardWidth = 78;
    const cardHeight = 120;
    const spacing = 12;
    const startX = (HUD_WIDTH - (cardWidth * 6 + spacing * 5)) / 2;

    for (let i = 0; i < 6; i++) {
      const card = new UICard(cardWidth, cardHeight, 35);
      card.x = startX + i * (cardWidth + spacing);
      card.y = 0;
      this.handDisplayContainer.addChild(card);
      this.handUI.cards.push(card);
    }

    // buttons
    const cardY = HUD_HEIGHT - hdp_MarginY - BTN_HEIGHT;
    const buyBtn = new UIButton({ text: "Buy Card", colour: BUY_BTN });
    buyBtn.position.set(BTN_WIDTH, cardY);

    const addBtn = new UIButton({ text: "Add to Tile", colour: ADD_TILE_BTN });
    addBtn.position.set(0, cardY);

    this.handDisplayContainer.addChild(buyBtn, addBtn);
  }

  updateHandDisplay(handKeys: Array<cardID | null>) {
    for (let i = 0; i < this.handUI.cards.length; i++) {
      const displayCard = this.handUI.cards[i];
      const key = handKeys[i];

      if (!key) {
        displayCard.hide();
        continue;
      }
      const card = Card.fromKey(key);

      displayCard.show(card.suit, card.rank);
    }
  }

  enter() {}
  exit() {}
}

function boardToWorld(x: number, y: number): [number, number] {
  return [x * (BOARD_WIDTH / BOARD_SIZE), y * (BOARD_HEIGHT / BOARD_SIZE)];
}
