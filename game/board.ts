import {Tile} from './tile.js';

export class Board {
  constructor() {
    this.grid = Array.from({ length: 9 }, () =>
  Array.from({ length: 9 }, () => new Tile())
);
    this.river = { position: { x: 5, y: 5 }, turns: 0, player: null };
  }

  placeCard(x, y, card, playerId) {
    if (this.isValidPlacement(x, y, playerId)) {
      this.grid[x][y] = { card, playerId, faceUp: false };
      return true;
    }
    return false;
  }

  moveUnit(fromX, fromY, toX, toY, playerId, unit) {
    const unit = this.grid[fromX][fromY];
    if (unit && unit.playerId === playerId && this.isValidMove(toX, toY)) {
      this.grid[toX][toY] = unit;
      this.grid[fromX][fromY] = null;
      return true;
    }
    return false;
  }

  isValidPlacement(x, y, playerId) {
    // Add logic to check if placement is valid (e.g., adjacent to conquered territory)
    return this.grid[x][y] === null;
  }

  isValidMove(x, y) {
    // Add logic to check if move is valid
    return x >= 0 && x < 9 && y >= 0 && y < 9 && this.grid[x][y] === null;
  }

  updateRiver() {
    currentRiverOwner =this.grid[this.river.position.x][this.river.position.y]
    if (){
      if
    }
  }
  checkRiverWin() {
    return this.river.turns == 5;
  }
}
