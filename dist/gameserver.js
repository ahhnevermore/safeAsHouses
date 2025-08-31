import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import { Board } from './game/board.js';
import { Player } from './game/player.js';
import { Deck } from './game/deck.js';
// Load environment variables
dotenv.config();
// Set up logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
    transports: [
        new winston.transports.File({ filename: 'app.log' }),
        new winston.transports.Console()
    ],
});
// Initialize Express app
const app = express();
app.set('trust proxy', 1);
// Create HTTP server
const server = http.createServer(app);
const io = new Server(server);
// Middleware
app.use(express.json());
app.use(express.static('public'));
// --- Game logic ---
// Initialize board, players, and deck
const board = new Board();
const players = {}; // Store players by their socket ID
const deck = new Deck();
deck.shuffle();
let currentTurn = 0; // Index of the current player's turn
const turnOrder = []; // Array to maintain the turn order
// Error handling middleware
app.use((req, res, next) => {
    res.status(404).sendFile('index.html', { root: 'public' });
});
io.on('connection', (socket) => {
    logger.info(`A user connected: ${socket.id}`);
    // Initialize player
    players[socket.id] = new Player(socket.id, `Player-${socket.id}`);
    // Add player to turn order
    turnOrder.push(socket.id);
    // Send initial hand
    const initialCards = deck.deal(5);
    players[socket.id].hand = initialCards;
    socket.emit('updateHand', initialCards);
    // Send current board state
    socket.emit('updateBoard', board.grid);
    // Emit turn information to all players
    const emitTurnInfo = () => {
        io.emit('turnInfo', {
            currentPlayer: turnOrder[currentTurn],
            turnOrder,
            players: Object.fromEntries(Object.entries(players).map(([id, player]) => [
                id,
                {
                    name: player.name,
                    coins: player.coins,
                    handSize: player.hand.length
                }
            ]))
        });
    };
    // Handle end of turn
    socket.on('endTurn', () => {
        if (socket.id === turnOrder[currentTurn]) {
            currentTurn = (currentTurn + 1) % turnOrder.length;
            emitTurnInfo();
        }
        else {
            socket.emit('error', 'Not your turn');
        }
    });
    // Handle tile click to show state and combat options
    socket.on('clickTile', ({ x, y }) => {
        const tile = board.grid[x]?.[y];
        if (tile) {
            const combatants = turnOrder.map((playerId) => {
                const player = players[playerId];
                return {
                    playerId,
                    hand: player.hand,
                };
            });
            socket.emit('tileInfo', { tile, combatants });
        }
        else {
            socket.emit('tileInfo', { tile: null });
        }
    });
    socket.on('placeCard', ({ x, y, cardIndex }) => {
        if (socket.id === turnOrder[currentTurn]) {
            const player = players[socket.id];
            const card = player.hand[cardIndex];
            if (card && board.placeCard(x, y, card, player.id)) {
                player.hand.splice(cardIndex, 1); // Remove card from hand
                io.emit('updateBoard', board.grid);
            }
            else {
                socket.emit('error', 'Invalid placement');
            }
        }
        else {
            socket.emit('error', 'Not your turn');
        }
    });
    socket.on('moveUnit', ({ fromX, fromY, toX, toY }) => {
        if (socket.id === turnOrder[currentTurn]) {
            const player = players[socket.id];
            if (board.moveUnit(fromX, fromY, toX, toY, player.id)) {
                io.emit('updateBoard', board.grid);
            }
            else {
                socket.emit('error', 'Invalid move');
            }
        }
        else {
            socket.emit('error', 'Not your turn');
        }
    });
    socket.on('buyCard', () => {
        if (socket.id === turnOrder[currentTurn]) {
            const player = players[socket.id];
            const card = player.buyCard(deck);
            if (card) {
                socket.emit('updateHand', player.hand);
            }
            else {
                socket.emit('error', 'Not enough coins');
            }
        }
        else {
            socket.emit('error', 'Not your turn');
        }
    });
    socket.on('disconnect', () => {
        logger.info(`A user disconnected: ${socket.id}`);
        delete players[socket.id];
        // Remove player from turn order
        const index = turnOrder.indexOf(socket.id);
        if (index !== -1) {
            turnOrder.splice(index, 1);
            if (currentTurn >= turnOrder.length) {
                currentTurn = 0;
            }
            emitTurnInfo();
        }
    });
    // Emit initial turn info
    emitTurnInfo();
});
// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Game server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=gameserver.js.map