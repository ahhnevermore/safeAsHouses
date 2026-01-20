import { coins, ID, unitID, cardID } from "./types.js";
import { Unit } from "./unit.js";
import {
  Card,
  Scope,
  TILE_CARD_LIMIT,
  TILE_UNIT_LIMIT,
  type Structure,
  River,
  Base,
  RIVER_TYPE,
  BASE_TYPE,
} from "./util.js";

export class Tile {
  owner: ID | null = null;
  units: Partial<Record<ID, Unit[]>> = {};
  bets: Partial<Record<ID, coins>> = {};
  structure: Structure | null = null;

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

  raise(playerID: ID, bet: coins) {
    if (bet > 0) {
      if (this.bets[playerID]) {
        this.bets[playerID] = (this.bets[playerID] + bet) as coins;
      } else {
        this.bets[playerID] = bet as coins;
      }
    }
  }

  placeUnit(
    unit: Unit,
    playerID: ID,
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

    return [success, territoryCaptured, unitSwallowed, unitID];
  }

  noCards(): boolean {
    return Object.values(this.units).every((arr) => !arr || arr.length === 0);
  }

  onlyOnePlayerCards(key: ID): boolean {
    const selfCards = this.units[key] ?? [];
    return (
      selfCards.length > 0 &&
      Object.entries(this.units)
        .filter(([k]) => k !== key)
        .every(([_, arr]) => (arr ?? []).length === 0) // undefined → []
    );
  }

  setStructure(structure: Structure) {
    this.structure = structure;
  }

  getUnit(playerID: ID, unitID: unitID): Unit | undefined {
    return this.units[playerID]?.filter((unit) => unit.id == unitID)[0];
  }

  removeUnit(playerID: ID, unitID: unitID) {
    this.units[playerID] = this.units[playerID]?.filter((unit) => unit.id != unitID)!;
  }

  addUnit(playerID: ID, unit: Unit) {
    this.units[playerID]?.push(unit);
  }

  getMods(playerID: ID, scope: Scope): Card[] {
    const playerUnits = this.units[playerID];
    if (!playerUnits) return [];
    return playerUnits.flatMap((unit) => unit.getMod(scope));
  }

  toJSON() {
    // Serialize units
    const serializedUnits: Record<string, any> = {};
    for (const playerID in this.units) {
      serializedUnits[playerID] = this.units[playerID as ID]?.map((u) => u.toJSON());
    }

    // Serialize structure by delegating to the structure's own toJSON method
    const serializedStructure = this.structure ? this.structure.toJSON() : null;

    return {
      owner: this.owner,
      units: serializedUnits,
      bets: this.bets,
      structure: serializedStructure,
    };
  }

  static fromJSON(data: any): Tile {
    const tile = new Tile();
    tile.owner = data.owner;
    tile.bets = data.bets;

    // Deserialize units
    for (const playerID in data.units) {
      tile.units[playerID as ID] = data.units[playerID].map((uData: any) => Unit.fromJSON(uData));
    }

    // Deserialize structure
    if (data.structure) {
      const structureType = data.structure.type;
      let structure: Structure | null = null;
      // We need to import the structure types to reconstruct them
      if (structureType === RIVER_TYPE) {
        structure = new River();
        if (data.structure.card) {
          (structure as River).setCard(Card.fromKey(data.structure.card as cardID));
        }
        (structure as River).owner = data.structure.owner;
        (structure as River).turns = data.structure.turns;
      } else if (structureType === BASE_TYPE) {
        structure = new Base();
      }
      if (structure) {
        tile.setStructure(structure);
      }
    }

    return tile;
  }
}
