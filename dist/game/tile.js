export class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
export class Tile {
    constructor() {
        this.owner = null;
        this.cards = {};
        this.bets = {};
        this.cards = {};
    }
    placeCard(card, playerID, bet) {
        if (this.owner == null) {
            this.owner = playerID;
        }
        if (this.cards[playerID] != null) {
            this.cards[playerID].push(card);
        }
        else {
            this.cards[playerID] = [card];
        }
        this.bets[playerID] = bet;
    }
}
//# sourceMappingURL=tile.js.map