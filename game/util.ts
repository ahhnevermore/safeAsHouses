import { cardID, coins, tileID } from "./types.js";

export const BOARD_SIZE: number = 9;
export const REG_MOVE: number = 1;
export const ACE_MOVE: number = 2;
export const KING_RADIUS: number = 2;
export const TILE_COINS: coins = 0.1 as coins;
export const CARD_PRICE: number = 1;
export const PLAYER_COUNT: number = 4;
export const RIVERS: tileID[] = ["4,4" as tileID];
export const BASES: tileID[] = ["0,0", "8,0", "0,8", "8,8"] as tileID[];
export const REG_HAND_SIZE: number = 5;
export const TILE_CARD_LIMIT: number = 5;
export const TILE_UNIT_LIMIT: number = 5;

export const RIVER_TYPE = "river";
export const BASE_TYPE = "base";

export enum Suit {
  Spades = 0,
  Hearts = 1,
  Diamonds = 2,
  Clubs = 3,
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

export enum Scope {
  Move = 0,
  Combat = 1,
  Income = 2,
}

export enum ClientState {
  MainMenu = 0,
  Lobby = 1,
  Game = 2,
  Victory = 3,
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
    return Math.abs(dest.x - this.x) <= radius && Math.abs(dest.y - this.y) <= radius;
  }

  getValidSquare(radius: number): Vec2[] {
    const tiles: Vec2[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = this.x + dx;
        const y = this.y + dy;

        if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) continue;

        tiles.push(new Vec2(x, y));
      }
    }
    return tiles;
  }

  toKey(): tileID {
    return `${this.x},${this.y}` as tileID;
  }

  static fromKey(key: tileID): Vec2 {
    const [xStr = "0", yStr = "0"] = key.split(",");
    return new Vec2(parseInt(xStr, 10), parseInt(yStr, 10));
  }
}

export class Card {
  suit: Suit;
  rank: Rank;

  constructor(suit: Suit, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
  }

  static fromKey(key: cardID): Card {
    const [suit = "0", rank = "0"] = key.split(",");
    return new Card(parseInt(suit, 10), parseInt(rank, 10));
  }

  toKey(): cardID {
    return `${this.suit},${this.rank}` as cardID;
  }
}

export class River {
  type: string = RIVER_TYPE;
  turns: number = 0;
  owner: string | null = null;
  def: number = 10;
  card: Card | null = null;
  constructor() {}
  setOwner(owner: string | null) {
    this.owner = owner;
  }
  setTurns(turns: number) {
    this.turns = turns;
  }
  setCard(card: Card) {
    this.card = card;
  }
}

export class Base {
  type: string = BASE_TYPE;
  def: number = 15;
  constructor() {}
}

export type Structure = River | Base;

export function isRiver(s: Structure | undefined | null): s is River {
  return !!s && s.type === RIVER_TYPE;
}

export function isBase(s: Structure | undefined | null): s is Base {
  return !!s && s.type === BASE_TYPE;
}
