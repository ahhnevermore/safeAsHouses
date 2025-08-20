import { Card } from "./card.js";
import { Colour } from "./util.js";
export class Deck {
    constructor() {
        this.cards = [];
        this.discards = [];
        const colours = [Colour.Black, Colour.Red, Colour.Green, Colour.Blue];
        for (const colour of colours) {
            for (let value = 1; value <= 13; value++) {
                this.cards.push(new Card(colour, value));
            }
        }
        this.shuffle();
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [
                this.cards[j],
                this.cards[i],
            ];
        }
    }
    deal(count) {
        return this.cards.splice(0, count);
    }
}
//# sourceMappingURL=deck.js.map