import type { Unit } from "./unit.js";
import { Tile } from "./tile.js";
import {
  Base,
  Scope,
  Rank,
  River,
  Vec2,
  Card,
  Suit,
  BOARD_SIZE,
  REG_MOVE,
  ACE_MOVE,
  KING_RADIUS,
} from "./util.js";

export class Board {
  grid: Tile[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => new Tile())
  );
  rivers: Vec2[] = [new Vec2(4, 4)];
  bases: Vec2[] = [
    new Vec2(0, 0),
    new Vec2(0, 8),
    new Vec2(8, 0),
    new Vec2(8, 8),
  ];
  territory: Record<string, Set<string>> = {};

  constructor() {
    this.rivers.forEach((elem) =>
      this.getTile(elem.x, elem.y)?.addStructure(new River())
    );

    this.bases.forEach((base) =>
      this.getTile(base.x, base.y)?.addStructure(new Base())
    );
  }

  getTile(x: number, y: number): Tile | undefined {
    const tile = this.grid[x]?.[y];
    return tile;
  }

  placeCard(xy: Vec2, unit: Unit, playerID: string, bet: number): boolean {
    if (this.isValidPlacement(xy, playerID)) {
      const tile = this.getTile(xy.x, xy.y)!;
      if (tile.placeUnit(unit, playerID, bet)) {
        this.territory[playerID]?.add(xy.toKey());
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  moveUnit(orig: Vec2, dest: Vec2, playerID: string, unitID: number): boolean {
    const origTile = this.getTile(orig.x, orig.y);
    if (origTile) {
      const unit = origTile.getUnit(playerID, unitID);
      if (unit && this.isValidMove(playerID, unit, orig, dest)) {
        origTile.removeUnit(playerID, unitID);
        const destTile = this.getTile(dest.x, dest.y);
        if (destTile) {
          if (destTile.noCards()) {
            this.territory[playerID]?.add(dest.toKey());
          }
          destTile.addUnit(playerID, unit);
          return true;
        }
      }
    }
    return false;
  }

  isValidPlacement(xy: Vec2, playerID: string): boolean {
    const square = xy.getValidSquare(REG_MOVE);
    for (let i = 0; i < square.length; i++) {
      const x = square[i]?.x;
      const y = square[i]?.y;
      if (x && y) {
        const tile = this.getTile(x, y);
        if (tile && tile.owner == playerID) {
          return true;
        }
      }
    }
    return false;
  }

  isValidMove(playerID: string, unit: Unit, orig: Vec2, dest: Vec2): boolean {
    if (
      dest.x >= 0 &&
      dest.x < BOARD_SIZE &&
      dest.y >= 0 &&
      dest.y < BOARD_SIZE
    ) {
      var isValid = false;
      isValid = orig.isWithinSquare(dest, REG_MOVE);
      const moveMods = unit.getMod(Scope.Move);
      if (moveMods.length > 0) {
        moveMods.forEach((card) => {
          if (card.rank == Rank.King) {
            return false;
          }
          if (card.rank == Rank.Ace) {
            isValid = orig.isWithinSquare(dest, ACE_MOVE);
          }
        });
      }
      return isValid;
    }
    return false;
  }

  updateRivers() {
    this.rivers.forEach((xy) => {
      const tile = this.getTile(xy.x, xy.y)!;
      const river = tile.structures.filter((structure) => {
        return structure instanceof River;
      })[0]!;
      if (tile.owner != null) {
        if (river.owner == tile.owner) {
          river.turns++;
        } else {
          river.owner = tile.owner;
          river.turns = 1;
        }
      }
    });
  }

  checkBaseWin(): string | null {
    var res = [];
    for (var i = 0; i < this.bases.length; i++) {
      const xy = this.bases[i]!;
      const tile = this.getTile(xy.x, xy.y)!;
      res.push(tile.owner);
    }
    return res.reduce<string | null>((acc, cur) => {
      if (cur === null) return acc; // ignore nulls
      if (acc === null) return cur; // first non-null found
      if (acc === cur) return acc; // same string, still valid
      return null; // mismatch → fail
    }, null);
  }

  checkRiverWin(): string | null {
    for (var i = 0; i < this.rivers.length; i++) {
      const xy = this.rivers[i]!;
      const tile = this.getTile(xy.x, xy.y)!;
      const river = tile.structures.filter((structure) => {
        return structure instanceof River;
      })[0]!;
      if (river.turns >= 10) {
        return river.owner;
      }
    }
    return null;
  }

  calculateIncome(): Record<string, number> {
    const res: Record<string, number> = {};
    for (const [playerID, tiles] of Object.entries(this.territory)) {
      res[playerID] = tiles.size;
      tiles.forEach((tileKey) => {
        const xy = Vec2.fromKey(tileKey);
        const tile = this.getTile(xy.x, xy.y);
        if (tile) {
          const incomeMods = tile.getMods(playerID, Scope.Income);
          var kingCount = 0;
          for (let i = 0; i < incomeMods.length; i++) {
            const card = incomeMods[i];
            if (card) {
              if (
                card.suit == Suit.Green &&
                card.rank == Rank.King &&
                kingCount < 1
              ) {
                kingCount++;
                const square = xy.getValidSquare(KING_RADIUS);

                res[playerID]! += square.filter((sq) =>
                  tiles.has(sq.toKey())
                ).length;
              }
            }
          }
        }
      });
    }
    return res;
  }
}
