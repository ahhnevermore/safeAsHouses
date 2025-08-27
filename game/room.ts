import { Board } from "./board.js";
import { Card, Scope, TILE_COINS, Vec2 } from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer, Socket as IOSocket } from "socket.io";
import { EventEmitter } from "events";
import { error } from "console";
import { Logger } from "winston";

export class Room extends EventEmitter {
  private static nextID = 1;
  deck: Deck;
  board: Board;
  id: string;
  players: Player[] = [];
  activeIndex: number = 0;
  turnTimer: NodeJS.Timeout | null = null;
  turnDuration: number = 30000;

  io: IOServer;
  logger: Logger;

  constructor(ioServer: IOServer, logger: Logger) {
    super();
    this.deck = new Deck();
    this.board = new Board();
    this.id = "room-" + Room.nextID++;

    this.io = ioServer;
    this.logger = logger.child({ roomID: this.id });
  }

  addPlayer(socket: IOSocket, name: string) {
    var player = new Player(socket.id, name);
    this.players.push(player);
    this.board.territory[player.id] = new Set<string>();

    socket.join(this.id);
    this.registerHandlers(socket);
    this.logger.info("A user connected:", socket.id);
  }

  isRoomFull() {
    return this.players.length == 4;
  }

  startGame() {
    this.startTurn();
  }

  startTurn() {
    try {
      const currentPlayerID = this.players[this.activeIndex]?.id as string;
      this.io.to(currentPlayerID).emit("yourTurn", {
        timer: this.turnDuration / 1000,
      });
      this.players.forEach((player) => {
        if (player.id != currentPlayerID) {
          this.io.to(player.id as string).emit("waitTurn", {
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
        this.io.to(currentPlayerID).emit("turnTimeout");
        this.advanceTurn();
      }, this.turnDuration);
    } catch (err) {
      this.windup("startTurn", err as Error);
    }
  }
  // Call this when the player takes a valid action
  refreshTurnTimer() {
    // Reset the timer to 30 seconds
    this.startTurn();
  }

  advanceTurn() {
    this.activeIndex = (this.activeIndex + 1) % this.players.length;
    const winner = this.board.checkRiverWin();
    if (winner) {
      this.broadcast(winner, Scope.Win);
    }
    const income = this.board.calculateIncome();
    for (const [playerID, count] of Object.entries(income)) {
      this.io.to(playerID).emit("income", count * TILE_COINS);
    }
    this.startTurn();
  }

  windup(reason: string, err?: Error) {
    if (err) {
      this.logger.error(`Room ${this.id} windup: ${reason}`, err);
    } else {
      this.logger.info(`Room ${this.id} windup: ${reason}`);
    }
    this.emit("windup", { reason, err });
  }

  broadcast(msg: string, reason?: Scope) {
    if (reason) {
      switch (reason) {
        case Scope.Win: {
          this.io.to(this.id).emit("winner", msg);
        }
      }
    }
  }

  registerHandlers(socket: IOSocket) {
    socket.on("disconnect", () => {
      this.players = this.players.filter((player) => {
        player.id != socket.id;
      });

      this.logger.info("A user disconnected:", socket.id);
    });

    socket.on("submitTurn", () => {
      this.advanceTurn();
    });
  }
}
