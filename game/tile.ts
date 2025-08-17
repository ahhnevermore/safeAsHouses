import { Card, Unit } from "./card.js";

export class Vec2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class Tile {
  owner: string | null = null;
  cards: Record<string, Card[]> = {};
  bets: Record<string, number> = {};
  constructor() {
    this.cards = {};
  }

  placeCard(card: Card, playerID: string, bet: number) {
    if (this.owner == null) {
      this.owner = playerID;
    }
    if (this.cards[playerID] != null) {
      this.cards[playerID].push(card);
    } else {
      this.cards[playerID] = [card]
    }
    this.bets[playerID] = bet;
  }
}
