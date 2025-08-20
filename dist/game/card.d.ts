export declare class Card {
    suit: number;
    rank: number;
    constructor(suit: number, rank: number);
}
export declare class Unit {
    card: Card;
    stack: Card[];
    faceup: boolean;
    constructor(card: Card);
    addToStack(card: Card): void;
}
//# sourceMappingURL=card.d.ts.map