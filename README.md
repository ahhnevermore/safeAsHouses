# Safe As Houses

---

The official repo for the original game Safe As Houses

Safe As Houses is a digital card/board game where you fight to conquer the board by wagering on card showdowns
Controlling territory gives you more income to wager more

You can win by :

1. Controlling the river for a set number of turns
2. Building a solitaire unit
3. Knocking everyone else out (of course)

Pitch phrase: Risk x Poker on a chessboard

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- Redis

**Note on Redis Configuration:** The application automatically configures Redis keyspace notifications on startup (required for the timer system). No manual configuration is needed for development. However, for production deployments where Redis may restart, it's recommended to add the following to your `redis.conf` file to ensure the setting persists:

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

To run the server:

```bash
npm run dev
```

## Rules

_Terms and Conditions Apply TM_

One round only finishes when all players pass. Then cards are dealt till players have 5. Income is received every turn
(this might be overly rewarding patient players, we'll see)

You play your cards face-down as a unit. This unit can travel about. When it encounters another opponent unit,
combat begins and you can add more cards from your hand while raising/ calling etc.

You can buy cards up till a hand size of 6.

Once a combat is resolved, your cards flip to form a single unit. This unit's power is half the face power of its stack of cards
This unit can have some specific powers based on the face cards in the unit stack

Ace- 2 move instead of 1
Jack- Helps siege structures
Queen- provides AOE combat bonus (cross-shaped)
King - is an immobile tower, provides AOE combat and income bonus

Effects of the face cards stack so be tactical, you might not want to freeze your Ace.
If you add a card onto a flipped unit, (the flipped unit is the only unit on the field, so no combat occuring) your card will be added to the flipped unit.

Flipped units can assist in combat (up to 4 on a given tile).

You can wager your flipped units as well as all cash to go all-in. The value of flipped units is 1 coin for 10 power

The hands follow the typical poker hands, adjusted based on length of the hand. They award point bonuses. The lowest hand of a particular type will "sabotage/cripple" (mechanic directly stolen from Cripple Mr Onion) the highest hand of that type. In other words, the lowest straight will beat the highest straight.

The river contains 1 card every round which you can match for better scores. 5 cards are the max that will be used to determine hand value (tough luck for those 6 card straight flushes)
