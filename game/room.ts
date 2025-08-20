import { Board } from "./board.js";
import { Card } from "./card.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer } from "socket.io";

export class Room {
  deck: Deck;
  board: Board;
  id: string | null = null;
  players: Player[] = [];
  activeIndex: number = 0;
  turnDuration: number = 30000; // 30 seconds
  turnTimer: NodeJS.Timeout | null = null;

  constructor(id: string, players: Player[] = []) {
    this.deck = new Deck();
    this.board = new Board();
    this.id = id;
    this.players = players;
  }
  
  addPlayer(socketId: string, name: string) {
    const player = new Player(socketId, name);
    this.players.push(player);
    return player;
  }

  removePlayer(socketId: string) {
    this.players = this.players.filter((player) => player.id !== socketId);
  }

  startGamePred(): boolean {
    return this.players.length === 4;
  }

  startGame(io: IOServer) {
    this.startTurn(io);
  }

  startTurn(io: IOServer) {
    const currentPlayer = this.players[this.activeIndex];
    if (!currentPlayer || !currentPlayer.id) return;
    
    const currentPlayerId = currentPlayer.id;

    io.to(currentPlayerId).emit("yourTurn", {
      timer: this.turnDuration / 1000,
    });
    
    this.players.forEach((player) => {
      if (player.id !== currentPlayerId) {
        io.to(player.id as string).emit("waitTurn", {
          currentplayer: this.activeIndex,
        });
      }
    });

    // Clear any previous timer
    if (this.turnTimer) clearTimeout(this.turnTimer);

    // Start countdown for this turn
    this.turnTimer = setTimeout(() => {
      // Timer expired: handle timeout (e.g., auto-end turn)
      if (currentPlayerId) {
        io.to(currentPlayerId).emit("turnTimeout");
      }
      this.advanceTurn(io);
    }, this.turnDuration);
  }

  // Call this when the player takes a valid action
  refreshTurnTimer(io: IOServer) {
    // Reset the timer to 30 seconds
    this.startTurn(io);
  }

  advanceTurn(io: IOServer) {
    this.activeIndex = (this.activeIndex + 1) % this.players.length;
    this.startTurn(io);
  }

  submitTurn(io: IOServer, event: string) {
    switch (event) {
      case "endTurn": {
        this.advanceTurn(io);
        break;
      }
    }
  }
}
