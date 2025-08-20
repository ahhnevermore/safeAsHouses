import { Card } from "./card.js";
export declare class Vec2 {
    x: number;
    y: number;
    constructor(x: number, y: number);
}
export declare class Tile {
    owner: string | null;
    cards: Record<string, Card[]>;
    bets: Record<string, number>;
    constructor();
    placeCard(card: Card, playerID: string, bet: number): void;
}
//# sourceMappingURL=tile.d.ts.map