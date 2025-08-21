import type { Unit } from "./unit.js";
import { Tile } from "./tile.js";
import { Base, ModScope, Rank, River, Vec2 } from "./util.js";

const boardSize: number = 9;
export class Board {
  grid: Tile[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => new Tile())
  );
  rivers: Vec2[] = [new Vec2(4, 4)];
  bases: Vec2[] = [
    new Vec2(0, 0),
    new Vec2(0, 8),
    new Vec2(8, 0),
    new Vec2(8, 8),
  ];

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
    if (this.isValidPlacement(xy.x, xy.y, playerID)) {
      const tile = this.getTile(xy.x, xy.y)!;
      return tile.placeUnit(unit, playerID, bet);
    }
    return false;
  }

  moveUnit(orig: Vec2, dest: Vec2, playerID: string, unitID: number) {
    const origTile = this.getTile(orig.x, orig.y);
    if (origTile) {
      const unit = origTile.getUnit(playerID, unitID);
      if (unit && this.isValidMove(playerID, unit, orig, dest)) {
        origTile.removeUnit(playerID, unitID);
        this.getTile(dest.x, dest.y)?.addUnit(playerID, unit);
        return true;
      }
      return false;
    }
  }

  isValidPlacement(x: number, y: number, playerID: string): boolean {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tile = this.grid[x + dx]?.[y + dy];
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
      dest.x < boardSize &&
      dest.y >= 0 &&
      dest.y < boardSize
    ) {
      var isValid = false;
      isValid = orig.isWithinSquare(dest, 1);
      const moveMods = unit.getMod(ModScope.Move);
      if (moveMods.length > 0) {
        moveMods.forEach((card) => {
          if (card.rank == Rank.King) {
            return false;
          }
          if (card.rank == Rank.Ace) {
            isValid = orig.isWithinSquare(dest, 2);
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

  checkRiverWin(): boolean {
    for (var i = 0; i < this.rivers.length; i++) {
      const xy = this.rivers[i]!;
      const tile = this.getTile(xy.x, xy.y)!;
      const river = tile.structures.filter((structure) => {
        return structure instanceof River;
      })[0]!;
      if (river.turns >= 10) {
        return true;
      }
    }
    return false;
  }
}
