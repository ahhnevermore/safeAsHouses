import { Board } from "./board.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
export class Room {
    constructor(id, players = []) {
        this.id = null;
        this.players = [];
        this.activeIndex = 0;
        this.turnDuration = 30000; // 30 seconds
        this.turnTimer = null;
        this.deck = new Deck();
        this.board = new Board();
        this.id = id;
        this.players = players;
    }
    addPlayer(socketId, name) {
        const player = new Player(socketId, name);
        this.players.push(player);
        return player;
    }
    removePlayer(socketId) {
        this.players = this.players.filter((player) => player.id !== socketId);
    }
    startGamePred() {
        return this.players.length === 4;
    }
    startGame(io) {
        this.startTurn(io);
    }
    startTurn(io) {
        const currentPlayer = this.players[this.activeIndex];
        if (!currentPlayer || !currentPlayer.id)
            return;
        const currentPlayerId = currentPlayer.id;
        io.to(currentPlayerId).emit("yourTurn", {
            timer: this.turnDuration / 1000,
        });
        this.players.forEach((player) => {
            if (player.id !== currentPlayerId) {
                io.to(player.id).emit("waitTurn", {
                    currentplayer: this.activeIndex,
                });
            }
        });
        // Clear any previous timer
        if (this.turnTimer)
            clearTimeout(this.turnTimer);
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
    refreshTurnTimer(io) {
        // Reset the timer to 30 seconds
        this.startTurn(io);
    }
    advanceTurn(io) {
        this.activeIndex = (this.activeIndex + 1) % this.players.length;
        this.startTurn(io);
    }
    submitTurn(io, event) {
        switch (event) {
            case "endTurn": {
                this.advanceTurn(io);
                break;
            }
        }
    }
}
//# sourceMappingURL=room.js.map