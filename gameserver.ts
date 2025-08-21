require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const Player = require("./game/player");
const Deck = require("./game/deck");
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.File({ filename: "app.log" }),
    new winston.transports.Console(),
  ],
});

const app = express();
app.set("trust proxy", 1);

const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

io.on("connection", (socket) => {
  logger.info("A user connected:", socket.id);

  // Initialize player
  players[socket.id] = new Player(socket.id, `Player-${socket.id}`);

  // Add player to turn order
  turnOrder.push(socket.id);

  // Emit turn information to all players
  const emitTurnInfo = () => {
    io.emit("turnInfo", {
      currentPlayer: turnOrder[currentTurn],
      turnOrder,
    });
  };

  // Handle end of turn
  socket.on("endTurn", () => {
    if (socket.id === turnOrder[currentTurn]) {
      currentTurn = (currentTurn + 1) % turnOrder.length;
      emitTurnInfo();
    } else {
      socket.emit("error", "Not your turn");
    }
  });

  // Handle tile click to show state and combat options
  socket.on("clickTile", ({ x, y }) => {
    const tile = board.grid[x][y];
    if (tile) {
      const combatants = turnOrder.map((playerId) => {
        const player = players[playerId];
        return {
          playerId,
          hand: player.hand,
        };
      });
      socket.emit("tileInfo", { tile, combatants });
    } else {
      socket.emit("tileInfo", { tile: null });
    }
  });

  socket.on("placeCard", ({ x, y, cardIndex }) => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      const card = player.hand[cardIndex];
      if (board.placeCard(x, y, card, player.id)) {
        player.hand.splice(cardIndex, 1); // Remove card from hand
        io.emit("updateBoard", board.grid);
      } else {
        socket.emit("error", "Invalid placement");
      }
    } else {
      socket.emit("error", "Not your turn");
    }
  });

  socket.on("moveUnit", ({ fromX, fromY, toX, toY }) => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      if (board.moveUnit(fromX, fromY, toX, toY, player.id)) {
        io.emit("updateBoard", board.grid);
      } else {
        socket.emit("error", "Invalid move");
      }
    } else {
      socket.emit("error", "Not your turn");
    }
  });

  socket.on("buyCard", () => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      const card = player.buyCard(deck);
      if (card) {
        socket.emit("updateHand", player.hand);
      } else {
        socket.emit("error", "Not enough coins");
      }
    } else {
      socket.emit("error", "Not your turn");
    }
  });

  socket.on("disconnect", () => {
    logger.info("A user disconnected:", socket.id);
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
