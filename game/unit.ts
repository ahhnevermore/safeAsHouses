import type { Card } from "./util.js";
import { Scope, Rank, Suit } from "./util.js";
export class Unit {
  private static nextID: number = 1;
  id: number;
  stack: Card[] = [];
  faceup: boolean = false;
  canMove: boolean = false;

  constructor(card: Card) {
    this.stack.push(card);
    this.id = Unit.nextID++;
  }

  addToStack(card: Card) {
    this.stack.push(card);
    this.stack.sort((a, b) => a.rank - b.rank);
  }

  getMod(modScope: Scope): Card[] {
    switch (modScope) {
      case Scope.Move:
        return this.stack.filter(
          (card) => card.rank == Rank.Ace || card.rank == Rank.King
        );
      case Scope.Combat:
        return this.stack.filter(
          (card) => card.rank == Rank.Jack || card.rank == Rank.Queen
        );
      case Scope.Income:
        return this.stack.filter(
          (card) => card.rank == Rank.King && card.suit == Suit.Green
        );
      default:
        return [];
    }
  }

  flip() {
    this.faceup = true;
  }
}
