import type { Card } from "./util.js";
import { ModScope, Rank } from "./util.js";
export class Unit {
  private static nextID: number = 1;
  id: number;
  stack: Card[] = [];
  faceup: boolean = false;

  constructor(card: Card) {
    this.stack.push(card);
    this.id = Unit.nextID++;
  }

  addToStack(card: Card) {
    this.stack.push(card);
    this.stack.sort((a, b) => a.rank - b.rank);
  }

  getMod(modScope: ModScope): Card[] {
    switch (modScope) {
      case ModScope.Move:
        return this.stack.filter(
          (card) => card.rank == Rank.Ace || card.rank == Rank.King
        );
      case ModScope.Combat:
        return this.stack.filter(
          (card) => card.rank == Rank.Jack || card.rank == Rank.Queen
        );
    }
  }

  flip() {
    this.faceup = true;
  }
}
