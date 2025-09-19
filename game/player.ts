import { Card, CARD_PRICE } from "./util.js";
import { Deck } from "./deck.js";
import { playerDTO, selfDTO } from "./dto.js";

export class Player {
  id: string;
  publicID: string;
  name: string;
  coins: number = 10;
  hand: Card[] = [];
  constructor(id: string, name: string, pubID: string) {
    this.id = id;
    this.name = name;
    this.publicID = pubID;
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
    return this.hand.some((card) => card.toKey() == cardVal);
  }

  discard(cardVal: string) {
    this.hand = this.hand.filter((card) => card.toKey() != cardVal);
  }

  toPlayerDTO(): playerDTO {
    return {
      id: this.publicID,
      name: this.name,
      handSize: this.hand.length,
    };
  }

  toSelfDTO(): selfDTO {
    return {
      id: this.publicID,
      name: this.name,
      coins: this.coins,
      hand: this.hand.map((card) => card.toKey()),
    };
  }

  takeCards(cards: Card[]) {
    this.hand.push(...cards);
  }
}
