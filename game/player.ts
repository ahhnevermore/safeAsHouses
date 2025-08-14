import { Card } from "./card.js";
import { Deck } from "./deck.js";

export class Player {
  id: string | null = null;
  name: string = "Guest";
  coins: number = 10;
  hand: Card[] = [];
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  buyCard(deck: Deck) {
    const cardCost = 2;
    if (this.coins >= cardCost) {
      const card = deck.deal(1)[0];
      if (card) {
        this.hand.push(card);
        this.coins -= cardCost;
        return card;
      }
    }
    return null;
  }
}
