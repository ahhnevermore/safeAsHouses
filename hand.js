class Hand {
  constructor() {
    this.cards = [];
  }

  addCards(newCards) {
    this.cards.push(...newCards);
  }

  showCards() {
    return this.cards;
  }
}

module.exports = Hand;