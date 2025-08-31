import { Tile } from './tile.js';
export class Board {
    constructor() {
        this.grid = [];
        this.grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Tile()));
        this.river = { position: { x: 5, y: 5 }, turns: 0, player: null };
    }
    placeCard(x, y, card, playerId) {
        if (this.isValidPlacement(x, y, playerId)) {
            const tile = this.grid[x]?.[y];
            if (tile) {
                tile.placeCard(card, playerId, 0);
                return true;
            }
        }
        return false;
    }
    moveUnit(fromX, fromY, toX, toY, playerId) {
        const fromTile = this.grid[fromX]?.[fromY];
        if (fromTile && fromTile.owner === playerId && this.isValidMove(toX, toY)) {
            const toTilePos = this.grid[toX]?.[toY];
            if (toTilePos) {
                this.grid[toX][toY] = fromTile;
                this.grid[fromX][fromY] = new Tile();
                return true;
            }
        }
        return false;
    }
    isValidPlacement(x, y, playerId) {
        // Add logic to check if placement is valid (e.g., adjacent to conquered territory)
        return x >= 0 && x < 9 && y >= 0 && y < 9;
    }
    isValidMove(x, y) {
        // Add logic to check if move is valid
        return x >= 0 && x < 9 && y >= 0 && y < 9;
    }
    updateRiver() {
        const riverX = this.river.position.x;
        const riverY = this.river.position.y;
        if (riverX >= 0 && riverX < 9 && riverY >= 0 && riverY < 9) {
            const currentRiverOwner = this.grid[riverX]?.[riverY]?.owner;
            if (currentRiverOwner) {
                if (this.river.player === currentRiverOwner) {
                    this.river.turns++;
                }
                else {
                    this.river.player = currentRiverOwner;
                    this.river.turns = 1;
                }
            }
        }
    }
    checkRiverWin() {
        return this.river.turns >= 5;
    }
}
//# sourceMappingURL=board.js.map