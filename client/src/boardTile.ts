import * as PIXI from "pixi.js";

const BASE_TILE_ALPHA: number = 0.5;
const OVERLAY_TILE_ALPHA: number = 0.7;

export class BoardTile extends PIXI.Container {
  base: PIXI.Sprite;
  overlay: PIXI.Sprite;
  xIndex: number;
  yIndex: number;
  occupiedBy: any = null;

  constructor(xIndex: number, yIndex: number, size: number) {
    super();
    this.xIndex = xIndex;
    this.yIndex = yIndex;

    // Base tile (main color)
    this.base = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.base.width = this.base.height = size;
    this.base.tint = 0xffffff;
    this.base.alpha = 0;
    this.addChild(this.base);

    // Overlay for highlights / selections
    this.overlay = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.overlay.width = this.overlay.height = size;
    this.overlay.tint = 0x0080ff;
    this.overlay.alpha = 0;
    this.addChild(this.overlay);

    // Position in world space
    this.x = xIndex * size;
    this.y = yIndex * size;

    // Interactivity setup
    this.eventMode = "static";
    this.cursor = "pointer";

    // Emit PIXI events (decoupled from logic)
    this.on("pointertap", () => this.emit("clicked", this));
    this.on("pointerover", () => this.emit("hovered", this));
    this.on("pointerout", () => this.emit("unhovered", this));
  }

  setColor(colour: number, alpha: number = BASE_TILE_ALPHA) {
    this.base.tint = colour;
    this.base.alpha = alpha;
  }

  setOverlay(colour: number, alpha: number = OVERLAY_TILE_ALPHA) {
    this.overlay.tint = colour;
    this.overlay.alpha = alpha;
  }

  clearOverlay() {
    this.overlay.alpha = 0;
  }
}
