import * as PIXI from "pixi.js";
import { BTN_HEIGHT, BTN_WIDTH, BtnName } from "./game.js";
import { colour } from "../../game/types.js";

export interface UIButtonOptions {
  btnName: BtnName;
  text: string;
  colour?: colour;
  width?: number;
  height?: number;
  iconTexture?: PIXI.Texture;
  onClick?: () => void;
  disabled?: boolean;
}

export class UIButton extends PIXI.Container {
  private bg: PIXI.Graphics;
  private btnText: PIXI.Text;
  private icon?: PIXI.Sprite;
  private baseColor: colour;
  private disabled: boolean;
  name: BtnName;

  constructor({
    btnName,
    text,
    colour = 0x4bfa82 as colour,
    width = BTN_WIDTH,
    height = BTN_HEIGHT,
    iconTexture,
    disabled = false,
  }: UIButtonOptions) {
    super();
    this.baseColor = colour;
    this.disabled = disabled;

    // Background
    this.bg = new PIXI.Graphics().rect(0, 0, width, height).fill({ color: this.baseColor });
    this.name = btnName;
    this.addChild(this.bg);

    // Icon (optional)
    if (iconTexture) {
      this.icon = new PIXI.Sprite(iconTexture);
      this.icon.scale.set(0.5);
      this.icon.anchor.set(0.5);
      this.icon.x = height / 2;
      this.icon.y = height / 2;
      this.addChild(this.icon);
    }

    // btnText
    this.btnText = new PIXI.Text({
      text,
      style: { fill: 0xffffff, fontSize: 14, fontWeight: "bold", fontFamily: "Courier" },
    });
    this.btnText.anchor.set(0.5);
    this.btnText.x = width / 2 + (this.icon ? height / 4 : 0);
    this.btnText.y = height / 2;
    this.addChild(this.btnText);

    // Interactivity
    this.interactive = true;
    this.cursor = "pointer";

    this.on("pointertap", this.onClick.bind(this));
    this.on("pointerover", this.onHover.bind(this));
    this.on("pointerout", this.onOut.bind(this));

    if (this.disabled) this.setEnabled(false);
  }

  private onClick() {
    if (this.disabled) return;

    // Press feedback
    this.scale.set(0.95);
    this.bg.tint = 0xcccccc;

    // Reset after short delay
    setTimeout(() => {
      this.scale.set(1);
      this.bg.tint = 0xffffff;
    }, 100);

    this.emit("clicked", this);
  }

  private onHover() {
    if (this.disabled) return;
    this.bg.tint = 0xdddddd;
  }

  private onOut() {
    if (this.disabled) return;
    this.bg.tint = 0xffffff;
  }

  public setEnabled(enabled: boolean) {
    this.disabled = !enabled;
    this.interactive = enabled;
    this.cursor = enabled ? "pointer" : "default";
    this.alpha = enabled ? 1.0 : 0.5;
    this.bg.tint = enabled ? 0xffffff : 0x999999;
    this.btnText.style.fill = enabled ? 0xffffff : 0xaaaaaa;
  }

  public setText(newText: string) {
    this.btnText.text = newText;
  }

  public setColour(newColour: colour) {
    this.baseColor = newColour;
    this.bg.clear().rect(0, 0, this.bg.width, this.bg.height).fill({ color: newColour });
  }
}
