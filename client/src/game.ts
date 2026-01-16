import * as PIXI from "pixi.js";
import { IState, StateManager } from "./stateManager.js";
import { Manager } from "socket.io-client";
import {
  Base,
  BASE_TYPE,
  BASES,
  BOARD_SIZE,
  Card,
  ClientState,
  isRiver,
  REG_MOVE,
  River,
  RIVER_TYPE,
  RIVERS,
  TILE_CARD_LIMIT,
  TILE_COINS,
  TILE_UNIT_LIMIT,
  Vec2,
} from "../../game/util.js";
import { playerDTO, selfDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";
import { BoardTile, Layer } from "./boardTile.js";
import { UIButton } from "./uibutton.js";
import { UICard } from "./uicard.js";
import { cardID, coins, colour, publicID, roomID } from "../../game/types.js";
import { UIUnit } from "./uiunit.js";

enum ActiveAction {
  None = 0,
  Select = 1,
  Move = 2,
}
export enum BtnName {
  move = "move",
  flip = "flip",
  call = "call",
  raise = "raise",
  allIn = "allIn",
  add = "add",
  buy = "buy",
  submit = "submit",
  roundEnd = "roundEnd",
}

const PLAYER_COLOURS: colour[] = [
  0x05d9fa as colour,
  0xfa2605 as colour,
  0xf807df as colour,
  0x07f820 as colour,
];
const HUD_WIDTH: number = 560;
const HUD_HEIGHT: number = 720;
const BOARD_WIDTH: number = 720;
const BOARD_HEIGHT: number = 720;
export const BACKGROUND_ALPHA: number = 0.6;
const HUD_BACKGROUND: colour = 0x134021 as colour;
const HUD_HIGHLIGHT: colour = 0x4bfa82 as colour;
const HUD_INLAY: colour = 0x164b27 as colour;
const HUD_INLAY2: colour = 0x18532b as colour;
const HUD_GREY: colour = 0x383d3a as colour;
const BTN_GREY: colour = 0x626a65 as colour;
const CALL_BTN: colour = 0xa66102 as colour;
const RAISE_BTN: colour = 0xc41910 as colour;
const ALL_IN_BTN: colour = 0x240302 as colour;
const MOVE_BTN: colour = 0x085687 as colour;
const BUY_BTN: colour = CALL_BTN;
const ADD_TILE_BTN: colour = 0x286333 as colour;
const FLIP_BTN: colour = ADD_TILE_BTN;
const SUBMIT_BTN: colour = CALL_BTN;
const END_TURN_BTN: colour = RAISE_BTN;

export const BTN_HEIGHT = 30;
export const BTN_WIDTH = 100;

const tdp_BoxWidth = 280;
const tdp_BoxHeight = 240;
const tdp_TagWidth = 30;
const tdp_HeaderHeight = 20;
const tdp_MarginY = 40;
const tdp_CardWidth = 50;
const tdp_CardHeight = 120;

const hdp_MarginY = 560;

const SRC_HAND = "handUI";
const SRC_TILE = "tileUI";

export enum GSig {
  Add = "addToTile",
  Submit = "submitTurn",
}

const TILE_SIZE = BOARD_WIDTH / BOARD_SIZE;
export class GameState extends PIXI.EventEmitter implements IState {
  container = new PIXI.Container();
  hud: PIXI.Container;
  tileDisplayContainer: PIXI.Container;
  handDisplayContainer: PIXI.Container;

  model: {
    roomId: roomID;
    myTurn: boolean;
    timeLeft: number;
    actPlayerID: publicID;
    players: playerDTO[];
    self: selfDTO | null;
    territory: Partial<Record<publicID, Set<string>>>;
    actAction: ActiveAction;
    votedEnd: boolean;
  } = {
    roomId: "" as roomID, 
    myTurn: false,
    timeLeft: 0,
    actPlayerID: "" as publicID,
    players: [],
    self: null,
    territory: {},
    actAction: ActiveAction.None,
    votedEnd: false,
  };

  mainUI: {
    tiles: BoardTile[][];
    playerHighlight: PIXI.Graphics | null;
    selTile: BoardTile | null;
    selCard: UICard | null;
    selUnit: UIUnit | null;
    selTileCard: UICard | null;
  } = {
    tiles: [],
    selTile: null,
    playerHighlight: null,
    selCard: null,
    selUnit: null,
    selTileCard: null,
  };

  handUI: {
    cards: UICard[];
    cardHighlight: PIXI.Graphics | null;
  } = { cards: [], cardHighlight: null };

  tileUI: {
    stats: Record<string, PIXI.Text[]>;
    actTile: PIXI.Text | null;
    playerDisplays: Partial<Record<string, PIXI.Container>>;
    structIcon: PIXI.Sprite | null;
    structCard: UICard | null;
    structText1: PIXI.Text | null;
    structText2: PIXI.Text | null;
    boxCards: UICard[][];
    boxUnits: UIUnit[][];
    boxCoins: PIXI.Text[];
    unitHighlight: PIXI.Graphics | null;
    cardHighlight: PIXI.Graphics | null;
  } = {
    stats: {},
    actTile: null,
    playerDisplays: {},
    structIcon: null,
    structCard: null,
    structText1: null,
    structText2: null,
    boxCards: [],
    boxUnits: [],
    boxCoins: [],
    unitHighlight: null,
    cardHighlight: null,
  };

  buttons: {
    move: UIButton | null;
    flip: UIButton | null;
    call: UIButton | null;
    raise: UIButton | null;
    allIn: UIButton | null;
    add: UIButton | null;
    buy: UIButton | null;
    submit: UIButton | null;
    roundEnd: UIButton | null;
  } = {
    move: null,
    flip: null,
    call: null,
    raise: null,
    allIn: null,
    add: null,
    buy: null,
    submit: null,
    roundEnd: null,
  };

  constructor() {
    super();
    const board = new PIXI.Sprite(PIXI.Texture.from(ASSETS.gameBoard));
    this.container.addChild(board);
    board.alpha = BACKGROUND_ALPHA;

    this.hud = new PIXI.Container();
    const hudBG = new PIXI.Graphics()
      .rect(720, 0, HUD_WIDTH, HUD_HEIGHT)
      .fill({ color: HUD_BACKGROUND });
    this.hud.addChild(hudBG);
    this.container.addChild(this.hud);

    this.mainUI.tiles = Array.from({ length: BOARD_SIZE }, (_, x) =>
      Array.from({ length: BOARD_SIZE }, (_, y) => {
        const tile = new BoardTile(x, y, TILE_SIZE);
        this.container.addChild(tile);

        // Listen for clicks directly
        tile.on("clicked", (t: BoardTile) => this.onTileClicked(t));

        return tile;
      })
    );

    this.buttons.submit = new UIButton({
      btnName: BtnName.submit,
      text: "Submit Turn",
      colour: SUBMIT_BTN,
    });
    this.buttons.submit.position.set(BOARD_WIDTH + HUD_WIDTH - 2 * BTN_WIDTH, 0);
    this.buttons.submit.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.roundEnd = new UIButton({
      btnName: BtnName.roundEnd,
      text: "Vote End",
      colour: END_TURN_BTN,
    });
    this.buttons.roundEnd.position.set(BOARD_WIDTH + HUD_WIDTH - BTN_WIDTH, 0);
    this.buttons.roundEnd.on("clicked", (btn: UIButton) => this.updateButtonState(btn));
    this.hud.addChild(this.buttons.submit, this.buttons.roundEnd);

    this.tileDisplayContainer = new PIXI.Container();
    this.tileDisplayContainer.position.set(BOARD_WIDTH, tdp_MarginY);
    this.hud.addChild(this.tileDisplayContainer);

    this.handDisplayContainer = new PIXI.Container();
    this.handDisplayContainer.position.set(BOARD_WIDTH, hdp_MarginY);
    this.hud.addChild(this.handDisplayContainer);

    this.mainUI.playerHighlight = new PIXI.Graphics()
      .rect(1, 1, tdp_BoxWidth - 1, tdp_HeaderHeight - 1)
      .stroke({ color: 0xffffff, width: 1 });
    this.hud.addChild(this.mainUI.playerHighlight);
  }

  onTileClicked(tile: BoardTile) {
    switch (this.model.actAction) {
      default: {
        if (this.mainUI.selTile) {
          this.mainUI.selTile.clearLayer(Layer.Select);
        }
        this.mainUI.selTile = tile;
        this.selectTile(tile);
        this.updateButtonState();
      }
    }
  }
  updateButtonState(clickedButton?: UIButton) {
    if (!this.model.myTurn) {
      Object.values(this.buttons).forEach((btn) => {
        if (btn) {
          btn.setEnabled(false);
        }
      });
      return;
    }

    if (clickedButton) {
      // Logic for emitting events based on which button was clicked
      switch (clickedButton.name) {
        case BtnName.submit:
          this.emit(GSig.Submit);
          break;
        // TODO: Add cases for other buttons like flip, placeCard, etc.
      }

      Object.values(this.buttons)
        .filter((btn) => btn && btn.name != clickedButton.name)
        .forEach((btn) => {
          if (btn) {
            btn.setEnabled(false);
          }
        });
      return;
    }

    const playerID = this.model.self?.id;
    if (this.mainUI.selTile && playerID) {
      const onePlayerCards = this.mainUI.selTile.onlyOnePlayerCards(playerID);
      const noCards = this.mainUI.selTile.noCards();

      if (this.mainUI.selUnit && this.mainUI.selUnit.model?.owner == playerID) {
        this.buttons.move?.setEnabled(this.mainUI.selUnit.canMove && onePlayerCards);

        this.buttons.flip?.setEnabled(!this.mainUI.selUnit.model.faceup);
      } else {
        this.buttons.move?.setEnabled(false);
        this.buttons.flip?.setEnabled(false);
      }

      this.buttons.call?.setEnabled(!onePlayerCards && !noCards);
      this.buttons.raise?.setEnabled(!onePlayerCards && !noCards);
      this.buttons.allIn?.setEnabled(!onePlayerCards && !noCards);

      this.buttons.add?.setEnabled(
        this.isValidPlacement(this.mainUI.selTile.xIndex, this.mainUI.selTile.yIndex, playerID)
      );
    }

    this.buttons.buy?.setEnabled(true);
    this.buttons.submit?.setEnabled(true);
    this.buttons.roundEnd?.setEnabled(!this.model.votedEnd);
  }

  onHandCardClicked(card: UICard) {
    if (this.handUI.cardHighlight) {
      this.handUI.cardHighlight.visible = true;
      this.handUI.cardHighlight.position.set(card.position.x, card.position.y);
    }
    this.mainUI.selCard = card;
  }

  onTileCardClicked(card: UICard) {
    if (this.tileUI.cardHighlight) {
      this.tileUI.cardHighlight.visible = true;
      this.tileUI.cardHighlight.position.set(card.position.x, card.position.y);
    }
    this.mainUI.selTileCard = card;
  }

  onUnitClicked(unit: UIUnit) {
    if (this.tileUI.unitHighlight) {
      this.tileUI.unitHighlight.visible = true;
      this.tileUI.unitHighlight.position.set(unit.position.x, unit.position.y);
    }
    this.mainUI.selUnit = unit;
  }

  selectTile(tile: BoardTile) {
    tile.setLayer(Layer.Select);
    if (this.tileUI.actTile) {
      this.tileUI.actTile.text = `${tile.xIndex + 1},${tile.yIndex + 1}`;
    }
    if (
      !this.tileUI.structIcon ||
      !this.tileUI.structText1 ||
      !this.tileUI.structText2 ||
      !this.tileUI.structCard
    ) {
      return;
    }
    if (tile.struct) {
      this.tileUI.structIcon.visible = true;
      this.tileUI.structText1.visible = true;
      switch (tile.struct.type) {
        case RIVER_TYPE:
          const river = tile.struct as River;
          this.tileUI.structIcon.texture = PIXI.Texture.from(ASSETS.castleIcon);
          this.tileUI.structIcon.scale.set(0.3);
          this.tileUI.structText1.text = river.def;
          if (river.card) {
            this.tileUI.structCard.visible = true;
            this.tileUI.structCard.show(river.card.suit, river.card.rank);
          }
          this.tileUI.structText2.visible = true;
          this.tileUI.structText2.text = river.turns;
          break;
        case BASE_TYPE:
          this.tileUI.structIcon.texture = PIXI.Texture.from(ASSETS.keepIcon);
          this.tileUI.structIcon.scale.set(0.7);
          this.tileUI.structText1.text = tile.struct.def;

          break;
      }
    } else {
      this.tileUI.structIcon.visible = false;
      this.tileUI.structText1.visible = false;
      this.tileUI.structText2.visible = false;
      this.tileUI.structCard.visible = false;
    }
  }

  updateMyTurn(myTurn: boolean, publicID: publicID, duration: number) {
    this.model.myTurn = myTurn;
    this.model.timeLeft = duration;
    this.model.actPlayerID = publicID;
    const actIndex = this.model.players.findIndex((pl) => pl.id == publicID);
    const col = actIndex % 2;
    const row = Math.floor(actIndex / 2);

    if (this.mainUI.playerHighlight) {
      this.mainUI.playerHighlight.position.set(
        BOARD_WIDTH + col * tdp_BoxWidth,
        tdp_MarginY + row * tdp_BoxHeight
      );
      this.mainUI.playerHighlight.tint = this.model.players[actIndex].colour ?? HUD_HIGHLIGHT;
    }

    this.updateButtonState();
  }

  initializeGame(
    roomId: roomID,
    playerDTOs: playerDTO[],
    selfDTO: selfDTO,
    riverCards: cardID[]
  ) {
    this.model.roomId = roomId;
    this.model.players = playerDTOs;
    this.model.self = selfDTO;
    this.setupTileDisplay();
    this.setupHandDisplay();
    this.setupPlayerBases();
    this.updateRivers(riverCards);
    this.updateHandDisplay(selfDTO.hand);
    const initialTile = this.mainUI.tiles[0]?.[0];
    if (initialTile) {
      this.onTileClicked(initialTile);
    }
  }

  updateRivers(riverCards: cardID[]) {
    RIVERS.forEach((r, i) => {
      const tileVec = Vec2.fromKey(r);
      const tile = this.mainUI.tiles[tileVec.x][tileVec.y];
      if (tile && tile.struct && isRiver(tile.struct) && i < riverCards.length) {
        const card = Card.fromKey(riverCards[i]!);
        tile.struct.setCard(card);
      }
    });

    // Re-select the currently selected tile to force a UI refresh
    if (this.mainUI.selTile) {
      this.selectTile(this.mainUI.selTile);
    }
  }
  setupPlayerBases() {
    this.model.players.forEach((pl, i) => {
      const tileVec = Vec2.fromKey(BASES[i]);
      this.model.territory[pl.id] = new Set<string>([BASES[i]]);
      const tile = this.mainUI.tiles[tileVec.x][tileVec.y];
      tile.setStructure(new Base());
      tile.setOwner(pl);
      console.log("index:", i, "base:", tileVec);
    });
    RIVERS.forEach((r) => {
      const tileVec = Vec2.fromKey(r);
      const tile = this.mainUI.tiles[tileVec.x][tileVec.y];
      tile.setStructure(new River());
    });
  }

  setupTileDisplay() {
    this.model.players.forEach((pl, i) => {
      pl.colour = PLAYER_COLOURS[i];
      const box = this.createTileDisplayBox(pl, i);
      const header = this.createPlayerHeader(pl);
      box.addChild(header);
      this.updatePlayerHeader(i);

      this.tileDisplayContainer.addChild(box);
      this.tileUI.playerDisplays[pl.id] = box;
    });
    this.tileUI.cardHighlight = new PIXI.Graphics()
      .roundRect(0, 0, tdp_CardWidth, tdp_CardHeight, 2)
      .stroke({ width: 2, color: HUD_HIGHLIGHT });
    this.tileUI.cardHighlight.visible = false;
    this.tileDisplayContainer.addChild(this.tileUI.cardHighlight);

    this.tileUI.unitHighlight = new PIXI.Graphics()
      .roundRect(0, 0, tdp_CardWidth, tdp_CardHeight, 2)
      .stroke({ width: 2, color: HUD_HIGHLIGHT });
    this.tileUI.unitHighlight.visible = false;
    this.tileDisplayContainer.addChild(this.tileUI.unitHighlight);

    this.buttons.move = new UIButton({ btnName: BtnName.move, text: "Move", colour: MOVE_BTN });
    this.buttons.move.position.set(0, 480);
    this.buttons.move.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.flip = new UIButton({ btnName: BtnName.flip, text: "Flip", colour: FLIP_BTN });
    this.buttons.flip.position.set(BTN_WIDTH, 480);
    this.buttons.flip.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.call = new UIButton({ btnName: BtnName.call, text: "Call", colour: CALL_BTN });
    this.buttons.call.position.set(2 * BTN_WIDTH, 480);
    this.buttons.call.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.raise = new UIButton({ btnName: BtnName.raise, text: "Raise", colour: RAISE_BTN });
    this.buttons.raise.position.set(3 * BTN_WIDTH, 480);
    this.buttons.raise.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.allIn = new UIButton({
      btnName: BtnName.allIn,
      text: "All In",
      colour: ALL_IN_BTN,
    });
    this.buttons.allIn.position.set(HUD_WIDTH - BTN_WIDTH, 480);
    this.buttons.allIn.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.tileUI.actTile = new PIXI.Text({
      text: "0,0",
      style: { fill: 0xffffff, fontSize: 20, fontFamily: "Courier", fontWeight: "bold" },
    });
    this.tileUI.actTile.position.set(10, -25);

    this.tileUI.structIcon = new PIXI.Sprite();
    this.tileUI.structIcon.position.set(80, -30);

    this.tileUI.structText1 = new PIXI.Text({
      text: "",
      style: { fill: 0xffffff, fontSize: 18, fontFamily: "Courier", fontWeight: "bold" },
    });
    this.tileUI.structText1.position.set(120, -25);

    this.tileUI.structCard = new UICard(27, 30, 16);
    this.tileUI.structCard.position.set(160, -30);

    this.tileUI.structText2 = new PIXI.Text({
      text: "",
      style: { fill: 0xffffff, fontSize: 18, fontFamily: "Courier", fontWeight: "bold" },
    });
    this.tileUI.structText2.position.set(205, -25);

    this.tileDisplayContainer.addChild(
      this.buttons.move,
      this.buttons.call,
      this.buttons.raise,
      this.buttons.allIn,
      this.buttons.flip,

      this.tileUI.actTile,

      this.tileUI.structIcon,
      this.tileUI.structCard,
      this.tileUI.structText1,
      this.tileUI.structText2
    );
  }

  createTileDisplayBox(pl: playerDTO, i: number): PIXI.Container {
    const box = new PIXI.Container();
    const bg = new PIXI.Graphics()
      .rect(0, 0, tdp_BoxWidth, tdp_BoxHeight)
      .fill({ color: [1, 2].includes(i) ? HUD_INLAY : HUD_INLAY2 });
    box.addChild(bg);

    const nameLabel = new PIXI.Text({
      text: pl.name,
      style: { fill: 0xffffff, fontSize: 14, fontFamily: "Courier", fontWeight: "bold" },
    });
    nameLabel.x = tdp_TagWidth + 20;
    nameLabel.y = 3;
    box.addChild(nameLabel);

    // Position (2×2 grid)
    const col = i % 2;
    const row = Math.floor(i / 2);
    box.x = col * tdp_BoxWidth;
    box.y = row * tdp_BoxHeight;

    const spacing = 7;
    const startX =
      (tdp_BoxWidth - (tdp_CardWidth * TILE_CARD_LIMIT + spacing * TILE_CARD_LIMIT - 1)) / 2;

    const cards: UICard[] = [];
    for (let i = 0; i < TILE_CARD_LIMIT; i++) {
      const card = new UICard(tdp_CardWidth, tdp_CardHeight, 35);
      card.on("clicked", (c: UICard) => {
        console.log("card clicked");
        this.onTileCardClicked(c);
      });
      card.x = startX + i * (tdp_CardWidth + spacing);
      card.y = tdp_BoxHeight / 2;
      box.addChild(card);
      cards.push(card);
    }
    this.tileUI.boxCards.push(cards);

    const units: UIUnit[] = [];
    for (let i = 0; i < TILE_UNIT_LIMIT; i++) {
      const unit = new UIUnit();
      unit.on("clicked", (c: UIUnit) => {
        console.log("unit clicked");
        this.onUnitClicked(c);
      });
      unit.x = startX + i * (tdp_CardWidth + spacing);
      unit.y = 10;
      box.addChild(unit);
      units.push(unit);
    }
    this.tileUI.boxUnits.push(units);

    const coinText = new PIXI.Text({
      style: {
        fill: 0xffffff,
        fontSize: 15,
        fontWeight: "bold",
        fontFamily: "Courier",
      },
    });

    coinText.x = tdp_BoxWidth - 20;
    coinText.y = tdp_BoxHeight / 2 - 20;
    box.addChild(coinText);

    this.tileUI.boxCoins.push(coinText);

    return box;
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

    const iconPaths = [ASSETS.cardsIcon, ASSETS.keepIcon, ASSETS.coinsIcon];
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
          fontSize: 15,
          fontWeight: "bold",
          fontFamily: "Courier",
        },
      });
      statLabel.x = labelX[i];
      statLabel.y = 12;
      statLabel.anchor.set(0, 0.5);
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
      card.on("clicked", (c: UICard) => {
        console.log("card clicked");
        this.onHandCardClicked(c);
      });
      card.x = startX + i * (cardWidth + spacing);
      card.y = 0;
      this.handDisplayContainer.addChild(card);
      this.handUI.cards.push(card);
    }

    // buttons
    const cardY = HUD_HEIGHT - hdp_MarginY - BTN_HEIGHT;
    this.buttons.buy = new UIButton({ btnName: BtnName.buy, text: "Buy Card", colour: BUY_BTN });
    this.buttons.buy.position.set(BTN_WIDTH, cardY);
    this.buttons.buy.on("clicked", (btn: UIButton) => this.updateButtonState(btn));

    this.buttons.add = new UIButton({
      btnName: BtnName.add,
      text: "Add to Tile",
      colour: ADD_TILE_BTN,
    });
    this.buttons.add.position.set(0, cardY);
    this.buttons.add.on("clicked", (btn: UIButton) => this.addButtonClicked(btn));

    this.handDisplayContainer.addChild(this.buttons.buy, this.buttons.add);

    this.handUI.cardHighlight = new PIXI.Graphics()
      .roundRect(0, 0, cardWidth, cardHeight, 2)
      .stroke({ width: 2, color: HUD_HIGHLIGHT });
    this.handUI.cardHighlight.visible = false;
    this.handDisplayContainer.addChild(this.handUI.cardHighlight);
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
  exit() {
    this.mainUI.tiles.flat().forEach((tile) => tile.removeAllListeners());
  }

  isValidPlacement(xa: number, ya: number, playerID: publicID): boolean {
    console.log(xa, ya);
    const xy = new Vec2(xa, ya);
    const square = xy.getValidSquare(REG_MOVE);
    for (let i = 0; i < square.length; i++) {
      const x = square[i]?.x;
      const y = square[i]?.y;

      const tile = this.mainUI.tiles[x][y];
      if (tile && tile.owner?.id == playerID) {
        return true;
      }
    }
    return false;
  }

  addButtonClicked(btn: UIButton) {
    this.updateButtonState(btn);
    const idx = this.handUI.cards.findIndex((card) => card == this.mainUI.selCard);
    if (this.model.self && this.model.self.hand.length > idx && this.mainUI.selTile) {
      this.emit(GSig.Add, this.model.self.hand[idx], this.mainUI.selTile.toKey());
    }
  }
}

function boardToWorld(x: number, y: number): [number, number] {
  return [x * (BOARD_WIDTH / BOARD_SIZE), y * (BOARD_HEIGHT / BOARD_SIZE)];
}
