export class Card {
  suit: number;
  rank: number;

  constructor(suit: number, rank: number) {
    this.suit = suit;
    this.rank = rank;
  }
}

export class Unit {
  card: Card;
  stack: Card[] = [];
  faceup: boolean = false;

  constructor(card: Card) {
    this.card = card;
  }

  addToStack(card: Card) {
    this.stack.push(card);
    this.stack.sort((a, b) => a.rank - b.rank);
  }
}
