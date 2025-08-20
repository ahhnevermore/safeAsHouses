import { Card } from "./card.js";
import { Deck } from "./deck.js";
export declare class Player {
    id: string | null;
    name: string;
    coins: number;
    hand: Card[];
    constructor(id: string, name: string);
    buyCard(deck: Deck): Card | null;
}
//# sourceMappingURL=player.d.ts.map