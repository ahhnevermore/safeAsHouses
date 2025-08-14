import { Card, Unit } from "./card.js";

export class Tile {
  owner: string | null = null;
  cards: Record<string, Card[]> = {};
  constructor() {
    this.cards = {};
  }

  placeCard(card) {}
}
