# Safe As Houses

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18 or later recommended)
- Redis

**Note on Redis Configuration:** The application automatically configures Redis keyspace notifications on startup (required for the distributed turn timer system). No manual configuration is needed for development. However, for production deployments where Redis may restart, it's recommended to add the following to your `redis.conf` file to ensure the setting persists:

```
notify-keyspace-events Ex
```

### Installation

1. Clone the repo:
   ```bash
   git clone <repo-url>
   ```
2. Install NPM packages:
   ```bash
   npm install
   ```

### Running the Application

To run the server for development:

```bash
npm run dev
```

To build and run the server for production (cluster mode):

```bash
npm run cluster
```

---

The official repo for the original game Safe As Houses

Safe As Houses is a digital card/board game where you fight to conquer the board by wagering on card showdowns
Controlling territory gives you more income to wager more

You can win by :

1. Controlling the river for a set number of turns
2. Building a solitaire unit
3. Knocking everyone else out (of course)

Pitch phrase: Risk x Poker on a chessboard

One round only finishes when all players pass. Then cards are drawn till 5 etc. Income is received every turn
(this might be overly rewarding patient players, well see)

You play your cards facedown as a unit. This unit can travel about.When it encounters another opponent unit,
combat begins and you can add more cards from your hand while raising/ calling etc.

You can buy cards up till a hand size of 7 (probably. we will see)

Once a combat is resolved, your cards flip to form a single unit. This unit's power is half the face power of its stack
This unit can have some specific powers
based on the face cards in the unit stack

Ace- 2 move instead of 1
Jack- Helps siege structures
Queen- provides combat bonus in an AOE
King - is an immobile tower, provides benefits in an AOE based on colour

Effects of the face cards stack so be tactical, you might not want to freeze your Ace
If you add a card onto a flipped unit, (the flipped unit is the only unit on the field, so no combat occuring)
your card will be added to the flipped unit

Flipped units can assist in combat

You can wager your flipped units as well as all cash to go all-in. The value of flipped units is 1 coin for 10 power

A list of hands will be provided below. Remember that the lowest hand of a particular type will "sabotage/cripple"
(mechanic directly stolen from Cripple Mr Onion, but more likely) the highest hand of that type. in other words, the lowest
straight will beat the highest straight(if its really rare, might make it so the rarer lower ones beat the more common types highest). Aces low.

The river contains 1 card every round which you can match for better scores
