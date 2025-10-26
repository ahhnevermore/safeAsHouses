import * as PIXI from "pixi.js";
import { colour, publicID } from "../../game/types.js";
import { BASE_TYPE, River, RIVER_TYPE, Structure } from "../../game/util.js";
import { playerDTO } from "../../game/dto.js";
import { ASSETS } from "./loader.js";
import { BACKGROUND_ALPHA } from "./game.js";

const BASE_ALPHA: number = 0.5;
const SELECT_ALPHA: number = 0.7;
const HOVER_ALPHA: number = 0.3;

const SELECT_OVERLAY: colour = 0x350354 as colour;
const HOVER_OVERLAY: colour = 0xffffff as colour;

export enum Layer {
  Base = 0,
  Select = 1,
  Hover = 2,
}

const layerConf: Record<Layer, { colour?: colour; alpha?: number }> = {
  [Layer.Base]: { alpha: BASE_ALPHA },
  [Layer.Select]: { colour: SELECT_OVERLAY, alpha: SELECT_ALPHA },
  [Layer.Hover]: { colour: HOVER_OVERLAY, alpha: HOVER_ALPHA },
};

export class BoardTile extends PIXI.Container {
  owner: playerDTO | null = null;
  base: PIXI.Sprite;
  select: PIXI.Sprite;
  hover: PIXI.Sprite;
  xIndex: number;
  yIndex: number;
  struct: Structure | null = null;

  constructor(xIndex: number, yIndex: number, size: number) {
    super();
    this.xIndex = xIndex;
    this.yIndex = yIndex;

    this.base = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.base.width = this.base.height = size;
    this.base.tint = 0xffffff;
    this.base.alpha = 0;
    this.addChild(this.base);

    this.select = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.select.width = this.select.height = size;
    this.select.alpha = 0;
    this.addChild(this.select);

    this.hover = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.hover.width = this.hover.height = size;
    this.hover.alpha = 0;
    this.addChild(this.hover);

    // Position in world space
    this.x = xIndex * size;
    this.y = yIndex * size;

    // Interactivity setup
    this.eventMode = "static";
    this.cursor = "pointer";

    // Emit PIXI events (decoupled from logic)
    this.on("pointerdown", () => this.emit("clicked", this));
    this.on("pointerover", () => this.setLayer(Layer.Hover));
    this.on("pointerout", () => this.clearLayer(Layer.Hover));
  }

  setOwner(owner: playerDTO) {
    this.owner = owner;
    this.setLayer(Layer.Base, owner.colour);
  }

  setStructure(struct: Structure) {
    this.struct = struct;
    if (struct.type == BASE_TYPE) {
      let sprite = new PIXI.Sprite(PIXI.Texture.from(ASSETS.keepIcon));
      sprite.x = 25;
      sprite.y = 25;
      sprite.alpha = 0.5;
      this.addChild(sprite);
    }
  }

  setLayer(layer: Layer, color?: colour, alpha?: number) {
    const sprite = this.getLayer(layer);

    const targetColor = color ?? layerConf[layer].colour ?? 0xffffff;
    const targetAlpha = alpha ?? layerConf[layer].alpha ?? 0.2;

    // early return if no change
    if (sprite.tint === targetColor && sprite.alpha === targetAlpha) return;

    sprite.tint = targetColor;
    sprite.alpha = targetAlpha;
  }

  clearLayer(layer: Layer) {
    const sprite = this.getLayer(layer);
    if (sprite.alpha === 0) return;
    sprite.alpha = 0;
  }

  getLayer(layer: Layer): PIXI.Sprite {
    switch (layer) {
      case Layer.Base:
        return this.base;
      case Layer.Select:
        return this.select;
      case Layer.Hover:
        return this.hover;
      default:
        console.warn("invalid Layer");
        return this.base;
    }
  }
}
