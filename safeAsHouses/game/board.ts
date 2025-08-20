import { Tile } from './tile.js';
import { Card } from './card.js';

interface RiverState {
  position: { x: number, y: number };
  turns: number;
  player: string | null;
}

export class Board {
  grid: Tile[][] = [];
  river: RiverState;

  constructor() {
    this.grid = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Tile())
    );
    this.river = { position: { x: 5, y: 5 }, turns: 0, player: null };
  }

  placeCard(x: number, y: number, card: Card, playerId: string): boolean {
    if (this.isValidPlacement(x, y, playerId)) {
      this.grid[x][y].placeCard(card, playerId, 0);
      return true;
    }
    return false;
  }

  moveUnit(fromX: number, fromY: number, toX: number, toY: number, playerId: string): boolean {
    const tile = this.grid[fromX][fromY];
    if (tile && tile.owner === playerId && this.isValidMove(toX, toY)) {
      // Implement move logic
      this.grid[toX][toY] = tile;
      this.grid[fromX][fromY] = new Tile();
      return true;
    }
    return false;
  }

  isValidPlacement(x: number, y: number, playerId: string): boolean {
    // Add logic to check if placement is valid (e.g., adjacent to conquered territory)
    return x >= 0 && x < 9 && y >= 0 && y < 9;
  }

  isValidMove(x: number, y: number): boolean {
    // Add logic to check if move is valid
    return x >= 0 && x < 9 && y >= 0 && y < 9;
  }

  updateRiver(): void {
    const currentRiverOwner = this.grid[this.river.position.x][this.river.position.y].owner;
    if (currentRiverOwner) {
      if (this.river.player === currentRiverOwner) {
        this.river.turns++;
      } else {
        this.river.player = currentRiverOwner;
        this.river.turns = 1;
      }
    }
  }

  checkRiverWin(): boolean {
    return this.river.turns >= 5;
  }
}
