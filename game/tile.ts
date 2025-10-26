import { ID, unitID } from "./types.js";
import { Unit } from "./unit.js";
import { Card, Scope, TILE_CARD_LIMIT, TILE_UNIT_LIMIT, type Structure } from "./util.js";

export class Tile {
  owner: ID | null = null;
  units: Partial<Record<string, Unit[]>> = {};
  bets: Partial<Record<string, number>> = {};
  structures: Structure[] = [];

  constructor() {}

  canAddUnit(playerID: ID, faceup: boolean): boolean {
    const units = this.units[playerID];
    if (units) {
      if (faceup) {
        return units.filter((u) => u.faceup).length < TILE_UNIT_LIMIT;
      } else {
        return units.filter((u) => !u.faceup).length < TILE_CARD_LIMIT;
      }
    }
    return false;
  }

  placeUnit(
    unit: Unit,
    playerID: ID,
    bet: number
  ): [success: boolean, territoryCaptured: boolean, unitSwallowed: boolean, unitID: unitID] {
    var territoryCaptured = false;
    var success = false;
    var unitSwallowed = false;
    var unitID = unit.id;
    if (this.owner != playerID && this.noCards()) {
      territoryCaptured = true;
    }
    if (this.units[playerID] != null) {
      //solitaire play
      if (this.onlyOnePlayerCards(playerID)) {
        const faceupCard = this.units[playerID].filter((unit) => unit.faceup)[0];
        if (faceupCard) {
          //this case is for handling placing a card onto only one faceup unit
          const topCard = unit.stack[0];
          if (topCard) {
            faceupCard.addToStack(topCard);
            success = true;
            unitSwallowed = true;
            unitID = faceupCard.id;
          }
        }
        //combat situation
      } else {
        this.units[playerID].push(unit);
        success = true;
      }
    } else {
      this.units[playerID] = [unit];
    }

    if (bet > 0) {
      if (this.bets[playerID]) {
        this.bets[playerID] += bet;
      } else {
        this.bets[playerID] = bet;
      }
    }
    return [success, territoryCaptured, unitSwallowed, unitID];
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
    this.units[playerID] = this.units[playerID]?.filter((unit) => unit.id != unitID)!;
  }

  addUnit(playerID: string, unit: Unit) {
    this.units[playerID]?.push(unit);
  }

  getMods(playerID: string, modScope: Scope): Card[] {
    if (this.units[playerID]) {
      return this.units[playerID]?.flatMap((unit) => unit.getMod(modScope));
    }
    return [];
  }
}
