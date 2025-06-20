const Card = require('./card');

class Deck {
  constructor() {
    this.cards = [];
    const colors = ['red', 'green', 'blue', 'black'];
    for (const color of colors) {
      for (let value = 1; value <= 13; value++) {
        this.cards.push(new Card(color, value));
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count) {
    return this.cards.splice(0, count);
  }
}

module.exports = Deck;