import { Board } from "./board.js";
import { Card, Scope, TILE_COINS, Vec2, type ClientEvents, type ServerEvents } from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer, Socket as IOSocket } from "socket.io";
import { EventEmitter } from "events";
import { error } from "console";
import { Logger } from "winston";
import { Unit } from "./unit.js";

export class Room extends EventEmitter {
  private static nextID = 1;
  pot: number = 0;
  deck: Deck;
  board: Board;
  id: string;
  players: Player[] = [];
  activeIndex: number = 0;
  turnTimer: NodeJS.Timeout | null = null;
  turnDuration: number = 30000;

  io: IOServer<ClientEvents, ServerEvents>;
  logger: Logger;

  constructor(ioServer: IOServer<ClientEvents, ServerEvents>, logger: Logger) {
    super();
    this.deck = new Deck();
    this.board = new Board();
    this.id = "room-" + Room.nextID++;

    this.io = ioServer;
    this.logger = logger.child({ roomID: this.id });
  }

  addPlayer(socket: IOSocket<ClientEvents, ServerEvents>, name: string) {
    var player = new Player(socket.id, name);
    this.players.push(player);
    this.board.territory[player.id] = new Set<string>();

    socket.join(this.id);
    this.registerHandlers(socket);
    this.logger.info("A user connected:", socket.id);
    this.sendRoom("joinGameAck", this.players.length);
  }

  isRoomFull() {
    return this.players.length == 4;
  }

  startGame() {
    this.startTurnTimer();
  }

  startTurnTimer() {
    try {
      const currentPlayerID = this.players[this.activeIndex]?.id as string;
      this.sendPlayer(currentPlayerID, "yourTurn", this.turnDuration);
      this.sendOtherPlayers(
        currentPlayerID,
        "waitTurn",
        this.players[this.activeIndex]?.name as string,
        this.turnDuration
      );

      // Clear any previous timer
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.turnTimer = null;

      // Start countdown for this turn
      this.turnTimer = setTimeout(() => {
        this.advanceTurn();
      }, this.turnDuration);
    } catch (err) {
      this.windup("startTurnTimer", err as Error);
    }
  }

  advanceTurn() {
    this.activeIndex = (this.activeIndex + 1) % this.players.length;
    const winner = this.board.checkRiverWin();
    if (winner) {
      this.sendRoom("winner", winner);
    }
    const income = this.board.calculateIncome();
    for (const [playerID, count] of Object.entries(income)) {
      this.sendPlayer(playerID, "income", count * TILE_COINS);
    }
    this.startTurnTimer();
  }

  windup(reason: string, err?: Error) {
    if (err) {
      this.logger.error(`Room ${this.id} windup: ${reason}`, err);
    } else {
      this.logger.info(`Room ${this.id} windup: ${reason}`);
    }
    this.emit("windup", { reason, err });
  }

  sendRoom<E extends keyof ServerEvents>(signal: E, ...args: Parameters<ServerEvents[E]>) {
    this.io.to(this.id).emit(signal, ...args);
  }

  sendPlayer<E extends keyof ServerEvents>(
    playerID: string,
    signal: E,
    ...args: Parameters<ServerEvents[E]>
  ) {
    this.io.to(playerID).emit(signal, ...args);
  }

  sendOtherPlayers<E extends keyof ServerEvents>(
    playerID: string,
    signal: E,
    ...args: Parameters<ServerEvents[E]>
  ) {
    const socket = this.io.sockets.sockets.get(playerID);
    if (socket) {
      socket.to(this.id).emit(signal, ...args);
    }
  }

  isPlayerTurn(playerID: string): boolean {
    return this.players[this.activeIndex]?.id == playerID;
  }

  getCurrPlayer(): Player | undefined {
    return this.players[this.activeIndex];
  }

  registerHandlers(socket: IOSocket<ClientEvents, ServerEvents>) {
    socket.on("disconnect", () => {
      if (this.isPlayerTurn(socket.id)) {
        this.advanceTurn();
      }
      this.players = this.players.filter((player) => player.id != socket.id);

      this.logger.info("A user disconnected:", socket.id);
    });

    socket.on("submitTurn", () => {
      if (this.isPlayerTurn(socket.id)) {
        this.advanceTurn();
      }
    });

    socket.on("flip", (tileID: string, unitID: number) => {
      if (this.isPlayerTurn(socket.id)) {
        if (this.board.flipUnit(socket.id, tileID, unitID)) {
          this.sendRoom("flipAck", tileID, unitID, socket.id);
          this.startTurnTimer();
          return;
        }
      }
      this.sendPlayer(socket.id, "flipRej", tileID, unitID);
    });

    socket.on("placeCard", (tileID: string, cardVal: string, bet: number) => {
      const currPlayer = this.getCurrPlayer();
      if (currPlayer && currPlayer.id == socket.id && currPlayer.hasCard(cardVal)) {
        const card = Card.fromKey(cardVal);
        const unit = new Unit(card);
        let [success, unitSwallowed, unitID] = this.board.placeCard(tileID, unit, socket.id, bet);
        if (success) {
          currPlayer.discard(cardVal);
          this.deck.addDiscard(Card.fromKey(cardVal));
          if (unitSwallowed) {
            this.sendOtherPlayers(socket.id, "placeCardPublic", tileID, bet, { unitID, cardVal });
          } else {
            this.sendOtherPlayers(socket.id, "placeCardPublic", tileID, bet, { unitID });
          }
          this.sendPlayer(socket.id, "placeCardAck", tileID, cardVal, bet, unitID, unitSwallowed);
          this.startTurnTimer();
          return;
        }
      }
      this.sendPlayer(socket.id, "placeCardRej", tileID, cardVal, bet);
    });

    socket.on("buyCard", () => {
      const currPlayer = this.getCurrPlayer();
      if (currPlayer && currPlayer.id == socket.id && currPlayer.canBuyCard()) {
        const card = this.deck.deal(1)[0];
        if (card) {
          const fee = currPlayer.buyCard(card);
          this.pot += fee;
          this.sendOtherPlayers(socket.id, "buyCardPublic");
          this.sendPlayer(socket.id, "buyCardAck", card.toKey());
          return;
        }
      }
      this.sendPlayer(socket.id, "buyCardRej");
    });
  }
}
