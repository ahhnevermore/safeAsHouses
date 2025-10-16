import * as PIXI from "pixi.js";

export const suitShapeMap: Record<number, keyof UICard["shapes"]> = {
  0: "circle",
  1: "diamond",
  2: "triangle",
  3: "square",
};

const rankDisplayMap: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};
const RED: number = 0xd32f2f;
const BLUE: number = 0x1976d2;
const ORANGE: number = 0xf57c00;
const GREY: number = 0x212121;
export class UICard extends PIXI.Container {
  public face: PIXI.Container;
  public shapes: {
    circle: PIXI.Graphics;
    diamond: PIXI.Graphics;
    triangle: PIXI.Graphics;
    square: PIXI.Graphics;
  };
  public cardLabel: PIXI.Text;

  constructor(cardWidth: number, cardHeight: number) {
    super();

    // --- face container
    this.face = new PIXI.Container();
    this.addChild(this.face);
    this.face.visible = false; // start hidden

    // --- background
    const bg = new PIXI.Graphics()
      .roundRect(0, 0, cardWidth, cardHeight, 4)
      .fill({ color: 0xffffff })
      .stroke({ color: 0x000000, width: 2 });
    this.face.addChild(bg);

    // --- small shapes
    const shapeX = cardWidth / 4;
    const shapeY = cardHeight / 5;
    const shapeSize = 8;

    const circle = new PIXI.Graphics().circle(shapeX, shapeY, shapeSize).fill({ color: RED });

    const diamond = new PIXI.Graphics()
      .poly([0, -shapeSize, shapeSize, 0, 0, shapeSize, -shapeSize, 0])
      .fill({ color: BLUE });
    diamond.position.set(shapeX, shapeY);

    const triangle = new PIXI.Graphics()
      .poly([0, -shapeSize, shapeSize, shapeSize, -shapeSize, shapeSize])
      .fill({ color: ORANGE });
    triangle.position.set(shapeX, shapeY);

    const rectScaledSize = shapeSize * 0.7;
    const square = new PIXI.Graphics()
      .rect(-rectScaledSize * 0, -rectScaledSize, rectScaledSize * 2, rectScaledSize * 2)
      .fill({ color: GREY });
    square.position.set(shapeX, shapeY);

    this.shapes = { circle, diamond, triangle, square };
    this.face.addChild(circle, diamond, triangle, square);

    // --- label text
    this.cardLabel = new PIXI.Text({
      text: "card",
      style: {
        fontSize: 20,
        fill: 0x000000,
        fontFamily: "Arial",
      },
    });
    this.cardLabel.position.set(cardWidth / 2, cardHeight / 2);
    this.face.addChild(this.cardLabel);
  }

  public show(rank: number | string, shape: keyof UICard["shapes"]) {
    this.face.visible = true;

    // Convert string to number if necessary
    const numericRank = typeof rank === "string" ? parseInt(rank, 10) : rank;

    const displayRank = rankDisplayMap[numericRank] ?? numericRank.toString();

    this.cardLabel.text = displayRank;

    // Toggle shapes
    for (const key in this.shapes) {
      this.shapes[key as keyof UICard["shapes"]].visible = key === shape;
    }
  }

  /** Hide this card */
  public hide() {
    this.face.visible = false;
  }
}
