import { Board } from "./board.js";
import { Card } from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer } from "socket.io";
import { EventEmitter } from "events";
import { error } from "console";

export class Room extends EventEmitter {
  deck: Deck;
  board: Board;
  id: string | null = null;
  players: Player[];
  activeIndex: number = 0;
  turnTimer: NodeJS.Timeout | null = null;
  turnDuration: number = 30000;
  constructor(id: string, players: Player[]) {
    super();
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
    try {
      const currentPlayerID = this.players[this.activeIndex]?.id as string;
      io.to(currentPlayerID).emit("yourTurn", {
        timer: this.turnDuration / 1000,
      });
      this.players.forEach((player) => {
        if (player.id != currentPlayerID) {
          io.to(player.id as string).emit("waitTurn", {
            currentplayer: this.activeIndex,
          });
        }
      });

      // Clear any previous timer
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = null;

      // Start countdown for this turn
      this.turnTimer = setTimeout(() => {
        // Timer expired: handle timeout (e.g., auto-end turn)
        io.to(currentPlayerID).emit("turnTimeout");
        this.advanceTurn(io);
      }, this.turnDuration);
    } catch (err) {
      this.windup("startTurn", err as Error);
    }
  }

  windup(reason: string, err: Error) {
    this.emit("windup", this.id, reason, err);
  }

  // Call this when the player takes a valid action
  refreshTurnTimer(io: IOServer) {
    // Reset the timer to 30 seconds
    this.startTurn(io);
  }

  advanceTurn(io: IOServer) {
    this.activeIndex = (this.activeIndex + 1) % this.players.length;
    this.board.this.startTurn(io);
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
