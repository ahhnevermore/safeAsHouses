import { Unit } from "./unit.js";
import type { Structure } from "./util.js";

export class Tile {
  owner: string | null = null;
  units: Record<string, Unit[]> = {};
  bets: Record<string, number> = {};
  structures: Structure[] = [];

  constructor() {}

  placeUnit(unit: Unit, playerID: string, bet: number): boolean {
    if (this.owner == null || (this.owner != playerID && this.noCards())) {
      this.owner = playerID;
    }
    if (this.units[playerID] != null) {
      if (this.onlyOnePlayerCards(playerID)) {
        const faceupCard = this.units[playerID].filter((unit) => {
          return unit.faceup;
        })[0];
        if (faceupCard) {
          //this case is for handling placing a card onto only one faceup unit
          const topCard = unit.stack[0];
          if (topCard) {
            faceupCard.addToStack(topCard);
          } else {
            return false;
          }
        } else {
          return false;
        }
      } else {
        this.units[playerID].push(unit);
      }
    } else {
      this.units[playerID] = [unit];
    }
    this.bets[playerID] = bet;
    return true;
  }

  noCards(): boolean {
    return Object.values(this.units).every((arr) => !arr || arr.length === 0);
  }

  onlyOnePlayerCards(key: string): boolean {
    return Object.entries(this.units)
      .filter(([k]) => k !== key)
      .every(([_, arr]) => (arr ?? []).length === 0); // undefined → []
  }

  addStructure(structure: Structure) {
    this.structures.push(structure);
  }

  getUnit(playerID: string, unitID: number): Unit | undefined {
    return this.units[playerID]?.filter((unit) => unit.id == unitID)[0];
  }

  removeUnit(playerID: string, unitID: number) {
    this.units[playerID] = this.units[playerID]?.filter(
      (unit) => unit.id != unitID
    )!;
  }

  addUnit(playerID: string, unit: Unit) {
    this.units[playerID]?.push(unit);
  }
}
