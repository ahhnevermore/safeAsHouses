import { unitID, cardID } from "./types.js";
import { Card } from "./util.js";
import { Scope, Rank, Suit } from "./util.js";
export class Unit {
  private static nextID: number = 1;
  id: unitID;
  stack: Card[] = [];
  faceup: boolean = false;
  canMove: boolean = false;

  constructor(card?: Card, initialize: boolean = true) {
    this.id = 0 as unitID; // Default initialization
    if (initialize && card) {
      this.stack.push(card);
      this.id = Unit.nextID++ as unitID;
    }
  }

  addToStack(card: Card) {
    this.stack.push(card);
    this.stack.sort((a, b) => a.rank - b.rank);
  }

  getMod(modScope: Scope): Card[] {
    switch (modScope) {
      case Scope.Move:
        return this.stack.filter((card) => card.rank == Rank.Ace || card.rank == Rank.King);
      case Scope.Combat:
        return this.stack.filter((card) => card.rank == Rank.Jack || card.rank == Rank.Queen);
      case Scope.Income:
        return this.stack.filter((card) => card.rank == Rank.King);
      default:
        return [];
    }
  }

  flip() {
    this.faceup = true;
  }

  toJSON() {
    return {
      id: this.id,
      stack: this.stack.map((c) => c.toKey()),
      faceup: this.faceup,
      canMove: this.canMove,
    };
  }

  static fromJSON(data: any): Unit {
    const unit = new Unit(undefined, false); // Create an empty unit
    // Re-hydrate the state
    unit.id = data.id;
    unit.stack = data.stack.map((key: string) => Card.fromKey(key as cardID));
    unit.faceup = data.faceup;
    unit.canMove = data.canMove;
    return unit;
  }
}
