import { Unit } from "./unit.js";
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
  RIVERS,
  BASES,
  isRiver,
} from "./util.js";
import { coins, ID, tileID, unitID } from "./types.js";

export class Board {
  grid: Tile[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => new Tile())
  );
  rivers: Vec2[] = RIVERS.map((el) => Vec2.fromKey(el));
  bases: Vec2[] = BASES.map((el) => Vec2.fromKey(el));
  territory: Partial<Record<string, Set<string>>> = {};

  constructor() {
    this.rivers.forEach((elem) => {
      const tile = this.getTile(elem.x, elem.y);
      if (tile) {
        tile.setStructure(new River());
      }
    });

    this.bases.forEach((base) => {
      const tile = this.getTile(base.x, base.y);
      if (tile) {
        tile.setStructure(new Base());
      }
    });
  }

  getTile(x: number, y: number): Tile | undefined {
    const tile = this.grid[x]?.[y];
    return tile;
  }

  placeCard(
    tileID: tileID,
    unit: Unit,
    playerID: ID,
    bet: number
  ): [success: boolean, unitSwallowed: boolean, unitID: unitID] {
    const xy = Vec2.fromKey(tileID);
    if (this.isValidPlacement(xy, playerID)) {
      const tile = this.getTile(xy.x, xy.y)!;
      if (tile.canAddUnit(playerID, false)) {
        let [success, territoryCaptured, unitSwallowed, unitID] = tile.placeUnit(
          unit,
          playerID,
          bet
        );
        if (success) {
          if (territoryCaptured) {
            this.capture(playerID, xy);
          }
          return [success, unitSwallowed, unitID];
        }
      }
    }
    return [false, false, 0 as unitID];
  }

  moveUnit(orig: Vec2, dest: Vec2, playerID: ID, unitID: unitID): boolean {
    const origTile = this.getTile(orig.x, orig.y);
    if (origTile) {
      const unit = origTile.getUnit(playerID, unitID);
      if (unit && this.isValidMove(unit, orig, dest)) {
        const destTile = this.getTile(dest.x, dest.y);
        if (
          destTile &&
          destTile.canAddUnit(playerID, unit.faceup) &&
          origTile.onlyOnePlayerCards(playerID) &&
          unit.canMove
        ) {
          origTile.removeUnit(playerID, unitID);

          if (destTile.noCards()) {
            this.capture(playerID, dest);
          }
          destTile.addUnit(playerID, unit);
          return true;
        }
      }
    }
    return false;
  }

  isValidPlacement(xy: Vec2, playerID: ID): boolean {
    const square = xy.getValidSquare(REG_MOVE);
    for (let i = 0; i < square.length; i++) {
      const x = square[i]?.x;
      const y = square[i]?.y;

      const tile = this.getTile(x, y);
      if (tile && tile.owner == playerID) {
        return true;
      }
    }
    return false;
  }

  isValidMove(unit: Unit, orig: Vec2, dest: Vec2): boolean {
    if (dest.x >= 0 && dest.x < BOARD_SIZE && dest.y >= 0 && dest.y < BOARD_SIZE) {
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
      if (tile.owner != null && isRiver(tile.structure)) {
        if (tile.structure.owner == tile.owner) {
          tile.structure.turns++;
        } else {
          tile.structure.owner = tile.owner;
          tile.structure.turns = 1;
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
      const tile = this.getTile(xy.x, xy.y);
      if (tile && isRiver(tile.structure) && tile.structure.turns >= 10) {
        return tile.structure.owner;
      }
    }
    return null;
  }

  calculateIncome(ids: ID[]): Record<ID, coins> {
    const res: Record<ID, coins> = {};
    ids.forEach((playerID) => {
      const tiles = this.territory[playerID];
      if (tiles) {
        res[playerID] = tiles.size as coins;
        tiles.forEach((tileKey) => {
          const xy = Vec2.fromKey(tileKey);
          const tile = this.getTile(xy.x, xy.y);
          if (tile) {
            const incomeMods = tile.getMods(playerID, Scope.Income);
            var kingCount = 0;
            for (let i = 0; i < incomeMods.length; i++) {
              const card = incomeMods[i];
              if (card) {
                if (card.rank == Rank.King && kingCount < 1) {
                  kingCount++;
                  const square = xy.getValidSquare(KING_RADIUS);
                  res[playerID] = (res[playerID] +
                    square.filter((sq) => tiles.has(sq.toKey())).length) as coins;
                }
              }
            }
          }
        });
      }
    });
    return res;
  }

  flipUnit(playerID: ID, tileID: tileID, unitID: unitID): boolean {
    const xy = Vec2.fromKey(tileID);
    const tile = this.getTile(xy.x, xy.y);
    if (tile) {
      if (tile.canAddUnit(playerID, true)) {
        const unit = tile.getUnit(playerID, unitID);
        if (unit && unit.faceup == false) {
          unit.flip();
          return true;
        }
      }
    }
    return false;
  }

  capture(playerID: ID, tileVec: Vec2) {
    const tile = this.getTile(tileVec.x, tileVec.y);
    if (tile) {
      const prevOwner = tile.owner;
      tile.owner = playerID;
      let playerTiles = this.territory[playerID];
      if (!playerTiles) {
        playerTiles = this.territory[playerID] = new Set<string>();
      }
      const tileID = tileVec.toKey();
      playerTiles.add(tileID);

      if (prevOwner) {
        let prevOwnerTiles = this.territory[prevOwner];
        if (prevOwnerTiles) {
          prevOwnerTiles.delete(tileID);
        }
      }
    }
  }
}
