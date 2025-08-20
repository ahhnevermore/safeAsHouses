export class Player {
    constructor(id, name) {
        this.id = null;
        this.name = "Guest";
        this.coins = 10;
        this.hand = [];
        this.id = id;
        this.name = name;
    }
    buyCard(deck) {
        const cardCost = 2;
        if (this.coins >= cardCost) {
            const card = deck.deal(1)[0];
            if (card) {
                this.hand.push(card);
                this.coins -= cardCost;
                return card;
            }
        }
        return null;
    }
}
//# sourceMappingURL=player.js.map