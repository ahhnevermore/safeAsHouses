import * as PIXI from "pixi.js";
import { BTN_HEIGHT, BTN_WIDTH } from "./game.js";

export interface UIButtonOptions {
  text: string;
  color?: number;
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
  private baseColor: number;
  private callback: () => void;
  private disabled: boolean;

  constructor({
    text,
    color = 0x4bfa82,
    width = BTN_WIDTH,
    height = BTN_HEIGHT,
    iconTexture,
    onClick = () => {},
    disabled = false,
  }: UIButtonOptions) {
    super();
    this.baseColor = color;
    this.callback = onClick;
    this.disabled = disabled;

    // Background
    this.bg = new PIXI.Graphics().rect(0, 0, width, height).fill({ color: this.baseColor });
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
      style: { fill: 0xffffff, fontSize: 12, fontWeight: "bold" },
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

    this.callback();
  }

  private onHover() {
    if (this.disabled) return;
    this.bg.tint = 0xbbbbbb;
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
  }

  public setText(newText: string) {
    this.btnText.text = newText;
  }

  public setColor(newColor: number) {
    this.baseColor = newColor;
    this.bg.clear().rect(0, 0, this.bg.width, this.bg.height).fill({ color: newColor });
  }
}
