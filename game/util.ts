export enum Colour {
  Black = 0,
  Red = 1,
  Green = 2,
  Blue = 3,
}

export enum Rank {
  Ace = 1,
  r2 = 2,
  r3 = 3,
  r4 = 4,
  r5 = 5,
  r6 = 6,
  r7 = 7,
  r8 = 8,
  r9 = 9,
  r10 = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
}

export enum ModScope {
  Move = 0,
  Combat = 1,
}

export class Vec2 {
  x: number = 0;
  y: number = 0;
  constructor(x: number, y: number) {
    this.set(x, y);
  }
  set(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  isWithinSquare(dest: Vec2, radius: number): boolean {
    return (
      Math.abs(dest.x - this.x) <= radius && Math.abs(dest.y - this.y) <= radius
    );
  }
}

export class River {
  turns: number = 5;
  owner: string | null = null;
  def: number = 10;
  constructor() {}
  setOwner(owner: string | null) {
    this.owner = owner;
  }
  setTurns(turns: number) {
    this.turns = turns;
  }
}

export class Base {
  def: number = 15;
  constructor() {}
}

export class Tower {
  def: number = 7;
  colour: Colour | null = null;
  constructor(colour: Colour) {
    this.colour = colour;
  }
}

export type Structure = River | Base | Tower;

export class Card {
  suit: Colour;
  rank: Rank;

  constructor(suit: Colour, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
  }
}
