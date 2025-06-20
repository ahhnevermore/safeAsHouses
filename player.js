class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.coins = 10; // Default starting coins
    this.hand = [];
    this.conqueredTerritories = [];
  }

  buyCard(deck) {
    const cardCost = 5; // Example cost
    if (this.coins >= cardCost) {
      const card = deck.deal(1)[0];
      this.hand.push(card);
      this.coins -= cardCost;
      return card;
    }
    return null;
  }

  addConqueredTerritory(x, y) {
    this.conqueredTerritories.push({ x, y });
  }
}

module.exports = Player;