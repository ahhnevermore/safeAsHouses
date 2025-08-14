import { Board } from "./board.js";
import { Card } from "./card.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer } from "socket.io";

class Room {
  deck: Deck;
  board: Board;
  id: string | null = null;
  players: Player[];
  activeIndex: number = 0;
  constructor(id: string, players: Player[]) {
    this.deck = new Deck();
    this.board = new Board();
    this.id = id;
    this.players = players;
  }
  addPlayer(socketId: string, name: string) {
    var player = new Player(socketId, name);
    this.players.push(player);
  }

  removePlayer(socketId: string) {
    this.players = this.players.filter((player) => player.id !== socketId);
  }

  startGamePred() {
    return this.players.length == 4;
  }

  startGame(io: IOServer) {
    this.startTurn(io);
  }

  startTurn(io: IOServer) {
    const currentPlayer = this.players[this.activeIndex].id;

    io.to(currentPlayerId).emit("yourTurn", {
      timer: this.turnDuration / 1000,
    });
    this.players.forEach((player) => {
      if (player.id != currentPlayerId) {
        io.to(player.id as string).emit("waitTurn", {
          currentplayer: this.activePlayer,
        });
      }
    });

    // Clear any previous timer
    if (this.turnTimer) clearTimeout(this.turnTimer);

    // Start countdown for this turn
    this.turnTimer = setTimeout(() => {
      // Timer expired: handle timeout (e.g., auto-end turn)
      io.to(currentPlayerId).emit("turnTimeout");
      this.advanceTurn(io);
    }, this.turnDuration);
  }

  // Call this when the player takes a valid action
  refreshTurnTimer(io) {
    // Reset the timer to 30 seconds
    this.startTurn(io);
  }

  advanceTurn(io) {
    this.activePlayer = (this.activePlayer + 1) % this.players.length;
    this.startTurn(io);
  }

  submitTurn(io, event) {
    switch (event) {
      case "endTurn": {
        this.board.this.advanceTurn(io);
      }
    }
  }
}
module.exports = Room;
