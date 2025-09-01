import { Card, CARD_PRICE } from "./util.js";
import { Deck } from "./deck.js";

export class Player {
  id: string;
  name: string;
  coins: number = 10;
  hand: Card[] = [];
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  buyCard(card: Card): number {
    this.hand.push(card);
    this.coins -= CARD_PRICE;
    return CARD_PRICE;
  }

  canBuyCard(): boolean {
    return this.coins >= CARD_PRICE;
  }

  hasCard(cardVal: string): boolean {
    return this.hand.some((card) => {
      card.toKey() == cardVal;
    });
  }

  discard(cardVal: string) {
    this.hand = this.hand.filter((card) => card.toKey() != cardVal);
  }
}
