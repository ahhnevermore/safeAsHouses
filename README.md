# Safe As Houses Game

This is a browser-based board game with cards. The backend is written in Node.js (TypeScript) and communication is done via Socket.IO.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to [http://localhost:3001](http://localhost:3001)

### Development

For development with auto-reloading:

```bash
npm run dev
```

## Game Rules

Safe As Houses is a strategic board game where players:

- Take turns placing cards on a 9x9 grid board
- Control territories by placing cards
- Try to control the river (position 5,5) for 5 consecutive turns to win
- Can purchase new cards using coins
- Can move units strategically across the board

## Technical Details

The game is built with:

- TypeScript for type-safe JavaScript
- Express.js for the web server
- Socket.IO for real-time communication
- PIXI.js for the client-side rendering

## Project Structure

```
safeAsHouses/
├── game/              # Game logic
│   ├── board.ts       # Game board management
│   ├── card.ts        # Card and Unit classes
│   ├── deck.ts        # Deck of cards management
│   ├── player.ts      # Player class
│   ├── room.ts        # Game room management
│   ├── tile.ts        # Tile class for the board
│   └── util.ts        # Utility functions and constants
├── public/            # Static files
│   ├── game.js        # Client-side game logic
│   └── index.html     # Main HTML file
├── dist/              # Compiled JavaScript (generated)
├── gameserver.ts      # Main server file
├── package.json       # Project configuration
└── tsconfig.json      # TypeScript configuration
```

## License

This project is licensed under the MIT License.
