import { Card } from "./util.js";
import { Suit } from "./util.js";

export class Deck {
  cards: Card[] = [];
  discards: Card[] = [];

  constructor() {
    const suits = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        this.cards.push(new Card(suit, rank));
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j] as Card, this.cards[i] as Card];
    }
  }

  deal(count: number): Card[] {
    if (count <= 0) return [];
    const dealt: Card[] = [];
    dealt.push(...this.cards.splice(0, Math.min(count, this.cards.length)));
    if (dealt.length < count) {
      // Refill from discards
      if (this.discards.length > 0) {
        this.cards = this.discards;
        this.discards = [];
        this.shuffle();

        const need = count - dealt.length;
        dealt.push(...this.cards.splice(0, Math.min(need, this.cards.length)));
      }
    }
    return dealt;
  }

  addDiscard(card: Card) {
    this.discards.push(card);
  }
}
