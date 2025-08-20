import { Tile } from './tile.js';
import { Card } from './card.js';
interface RiverState {
    position: {
        x: number;
        y: number;
    };
    turns: number;
    player: string | null;
}
export declare class Board {
    grid: Tile[][];
    river: RiverState;
    constructor();
    placeCard(x: number, y: number, card: Card, playerId: string): boolean;
    moveUnit(fromX: number, fromY: number, toX: number, toY: number, playerId: string): boolean;
    isValidPlacement(x: number, y: number, playerId: string): boolean;
    isValidMove(x: number, y: number): boolean;
    updateRiver(): void;
    checkRiverWin(): boolean;
}
export {};
//# sourceMappingURL=board.d.ts.map