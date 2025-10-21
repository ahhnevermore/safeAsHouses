import { Card, CARD_PRICE } from "./util.js";
import { playerDTO, selfDTO } from "./dto.js";
import { ID, publicID } from "./types.js";

export class Player {
  id: ID;
  publicID: publicID;
  name: string;
  coins: number = 10;
  hand: Card[] = [];
  constructor(id: ID, name: string, pubID: publicID) {
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
      coins: this.coins,
      territory: 1,
    };
  }

  toSelfDTO(): selfDTO {
    return {
      id: this.publicID,
      name: this.name,
      hand: this.hand.map((card) => card.toKey()),
    };
  }

  takeCards(cards: Card[]) {
    this.hand.push(...cards);
  }
}
