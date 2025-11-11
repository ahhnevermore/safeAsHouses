import * as PIXI from "pixi.js";
import { Rank, Suit } from "../../game/util.js";

const suitInfo = {
  [Suit.Spades]: { symbol: "♠", color: 0x000000 },
  [Suit.Hearts]: { symbol: "♥", color: 0xff0000 },
  [Suit.Diamonds]: { symbol: "♦", color: 0xff0000 },
  [Suit.Clubs]: { symbol: "♣", color: 0x000000 },
} as const;

function getSuitInfo(suit: Suit) {
  return suitInfo[suit];
}

const rankDisplayMap: Record<Rank, string> = {
  [Rank.Ace]: "A",
  [Rank.Jack]: "J",
  [Rank.Queen]: "Q",
  [Rank.King]: "K",
  [Rank.r2]: "2",
  [Rank.r3]: "3",
  [Rank.r4]: "4",
  [Rank.r5]: "5",
  [Rank.r6]: "6",
  [Rank.r7]: "7",
  [Rank.r8]: "8",
  [Rank.r9]: "9",
  [Rank.r10]: "10",
};

export class UICard extends PIXI.Container {
  public face: PIXI.Container;
  public cardLabel: PIXI.Text;

  constructor(cardWidth: number, cardHeight: number, fontsize: number) {
    super();

    // --- face container
    this.face = new PIXI.Container();
    this.addChild(this.face);
    this.face.visible = false;

    // --- background
    const bg = new PIXI.Graphics()
      .roundRect(0, 0, cardWidth, cardHeight, 6)
      .fill({ color: 0xffffff })
      .stroke({ color: 0x000000, width: 2 });
    this.face.addChild(bg);

    // --- label (centered)
    this.cardLabel = new PIXI.Text({
      text: "card",
      style: {
        fontSize: fontsize,
        fill: 0x000000,
        fontFamily: "Courier",
        fontWeight: "bold",
      },
    });
    this.cardLabel.anchor.set(0.5);
    this.cardLabel.position.set(cardWidth / 2, cardHeight / 2);
    this.face.addChild(this.cardLabel);

    this.interactive = true;
    this.cursor = "pointer";
    this.on("pointerdown", () => this.emit("clicked", this));
  }

  public show(suit: Suit, rank: Rank) {
    this.face.visible = true;

    const { symbol, color } = getSuitInfo(suit);

    // Convert rank to display label
    const rankText =
      rankDisplayMap[rank] ?? (rank >= Rank.r2 && rank <= Rank.r10 ? rank.toString() : "?");

    this.cardLabel.text = `${rankText}${symbol}`;
    this.cardLabel.style.fill = color;
  }

  public hide() {
    this.face.visible = false;
  }
}
