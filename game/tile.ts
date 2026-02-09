import { coins, ID, unitID, cardID, Result } from "./types.js";
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

  canAddUnit(playerID: ID, faceup: boolean): Result<boolean> {
    const units = this.units[playerID];
    if (units) {
      if (faceup) {
        return { ok: true, val: units.filter((u) => u.faceup).length < TILE_UNIT_LIMIT };
      } else {
        return { ok: true, val: units.filter((u) => !u.faceup).length < TILE_CARD_LIMIT };
      }
    }
    return { ok: false, error: "units array invalid`" };
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

  placeCard(cardVal: cardID, playerID: ID): Result<{ territoryCaptured: boolean; unit: Unit }> {
    if (this.canAddUnit(playerID, false)) {
      let card = Card.fromKey(cardVal);
      let territoryCaptured = false;
      let unit = new Unit(card);
      if (this.owner !== playerID && this.noCards()) {
        territoryCaptured = true;
      }
      const playerUnits = this.units[playerID];
      if (playerUnits) {
        // Player already has units on this tile.
        if (this.onlyOnePlayerCards(playerID)) {
          // Solitaire play: adding a card to an existing face-up unit.
          const faceupUnit = playerUnits.find((u) => u.faceup);
          if (faceupUnit) {
            faceupUnit.addToStack(card);
            unit = faceupUnit;
          } else {
            return {
              ok: false,
              error: "Solitaire play failed: no face-up unit or no card to add.",
            };
          }
        } else {
          // Standard placement in a contested tile.
          playerUnits.push(unit);
        }
      } else {
        // First unit for this player on this tile.
        this.units[playerID] = [unit];
      }
      return { ok: true, val: { territoryCaptured, unit } };
    }
    return {
      ok: false,
      error: "unit cannot be added - TILE CARD LIMIT",
    };
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
