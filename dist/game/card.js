export class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }
}
export class Unit {
    constructor(card) {
        this.stack = [];
        this.faceup = false;
        this.card = card;
    }
    addToStack(card) {
        this.stack.push(card);
        this.stack.sort((a, b) => a.rank - b.rank);
    }
}
//# sourceMappingURL=card.js.map