import { Board } from "./board.js";
import { type ClientEvents, type ServerEvents } from "./events.js";
import {
  BASES,
  Card,
  isRiver,
  PLAYER_COUNT,
  REG_HAND_SIZE,
  River,
  RIVER_TYPE,
  RIVERS,
  Scope,
  TILE_COINS,
  TURN_TIMER_MAIN_SECONDS,
  Vec2,
} from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer, Socket as IOSocket } from "socket.io";
import { EventEmitter } from "events";
import { Logger } from "winston";
import { Unit } from "./unit.js";
import { cardID, coins, ID, publicID, Result, roomID, tileID, unitID } from "./types.js";
import { playerDTO } from "./dto.js";
import { TimerManager } from "../server/timer.js";

const turnDurationMs = TURN_TIMER_MAIN_SECONDS * 1000;

export class Room extends EventEmitter {
  private static nextID = 1;
  pot: number = 0;
  deck: Deck;
  board: Board;
  id: roomID;
  players: Player[] = [];
  actIndex: number = 0;
  round: number = 0;

  io: IOServer<ClientEvents, ServerEvents>;
  logger: Logger;
  timerManager: TimerManager;

  constructor(
    ioServer: IOServer<ClientEvents, ServerEvents>,
    logger: Logger,
    timerManager: TimerManager,
    initialize: boolean = true,
  ) {
    super();
    this.io = ioServer;
    this.logger = logger;
    this.timerManager = timerManager;

    if (initialize) {
      this.deck = new Deck();
      this.board = new Board();
      this.id = ("room-" + Room.nextID++) as roomID;
      this.logger = this.logger.child({ roomID: this.id });
    } else {
      // If we're not initializing, these will be set by the deserializer
      this.deck = null as any;
      this.board = null as any;
      this.id = "" as roomID;
    }
  }

  addPlayer(userId: ID, name: string): number {
    if (this.players.some((p) => p.id === userId)) {
      return this.players.length; // Already added
    }
    var player = new Player(userId, name, this.players.length.toString() as publicID);
    this.players.push(player);
    this.board.territory[player.id] = new Set<tileID>();

    return this.players.length;
  }

  getPlayerByUserId(userId: ID): Player | undefined {
    return this.players.find((pl) => pl.id === userId);
  }

  sendReconnectionState(userId: ID) {
    const player = this.getPlayerByUserId(userId);
    if (!player) return;

    const playerDTOs = this.players.map((pl) => pl.toPlayerDTO());
    const riverCards: cardID[] = [];

    // Gather all current river cards
    RIVERS.forEach((r) => {
      const tileVec = Vec2.fromKey(r);
      const tile = this.board.getTile(tileVec.x, tileVec.y);
      if (tile && tile.structure && isRiver(tile.structure)) {
        const card = (tile.structure as River).card;
        if (card) {
          riverCards.push(card.toKey());
        }
      }
    });

    // Send the current game state to the reconnecting player
    this.sendPlayer(
      userId,
      "roundStart",
      playerDTOs,
      player.toSelfDTO(),
      riverCards,
      false, // Not a fresh game start, just a reconnection
    );

    if (this.isPlayerTurn(userId)) {
      this.sendPlayer(userId, "yourTurn", player.publicID, turnDurationMs);
    } else {
      const actPlayer = this.getCurrPlayer();
      if (actPlayer) {
        this.sendPlayer(userId, "waitTurn", actPlayer.publicID, turnDurationMs);
      }
    }
  }

  isRoomFull() {
    return this.players.length == PLAYER_COUNT;
  }

  startGame() {
    this.startRound(1);
  }
  async startRound(num: number) {
    this.round = num;
    this.players.forEach((pl, idx) => {
      pl.takeCards(this.deck.deal(REG_HAND_SIZE - pl.hand.length));
      this.board.capture(pl.id, this.board.bases[idx]);
    });
    const riverCards: cardID[] = [];
    RIVERS.forEach((r) => {
      const tileVec = Vec2.fromKey(r);
      const tile = this.board.getTile(tileVec.x, tileVec.y);
      if (tile && tile.structure && isRiver(tile.structure)) {
        if (isRiver(tile.structure)) {
          const dealt = this.deck.deal(1);
          if (dealt.length >= 1) {
            const riverCard = dealt[0];
            tile.structure.setCard(riverCard);
            riverCards.push(riverCard.toKey());
          }
        }
      }
    });
    const playerDTOs = this.players.map((pl) => pl.toPlayerDTO());
    this.players.forEach((pl) => {
      this.sendPlayer(pl.id, "roundStart", playerDTOs, pl.toSelfDTO(), riverCards, true);
    });

    if (this.round === 1) {
      await this.timerManager.initializeGameTimers(this.id);
    } else {
      await this.timerManager.startTurnTimers(this.id);
    }

    const actPlayer = this.players[this.actIndex];
    this.sendPlayer(actPlayer.id, "yourTurn", actPlayer.publicID, turnDurationMs);
    this.sendOtherPlayers(actPlayer.id, "waitTurn", actPlayer.publicID, turnDurationMs);
  }

  advanceTurn(): boolean {
    this.actIndex = (this.actIndex + 1) % this.players.length;
    const winner = this.board.checkRiverWin();
    if (winner) {
      const winningPlayer = this.players.find((pl) => pl.id == winner);
      if (winningPlayer) {
        this.sendRoom("winner", winningPlayer.publicID);
        return true;
      }
    }
    const income = this.board.calculateIncome(this.players.map((pl) => pl.id));
    for (const [playerID, count] of Object.entries(income)) {
      const player = this.getPlayerByUserId(playerID as ID);
      const incomeAmount = (count * TILE_COINS) as coins;
      if (player && incomeAmount > 0) {
        player.coins = (player.coins + incomeAmount) as coins;
      }
    }

    // After all incomes are applied, create a single net worth object to broadcast.
    const netWorths: Record<publicID, coins> = {};
    this.players.forEach((p) => {
      netWorths[p.publicID] = p.coins;
    });
    this.sendRoom("income", netWorths);

    // Send UI notifications for the new active player
    const actPlayer = this.players[this.actIndex];
    this.sendPlayer(actPlayer.id, "yourTurn", actPlayer.publicID, turnDurationMs);
    this.sendOtherPlayers(actPlayer.id, "waitTurn", actPlayer.publicID, turnDurationMs);
    return false; // Game is not over
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
    playerID: ID,
    signal: E,
    ...args: Parameters<ServerEvents[E]>
  ) {
    this.io.to(playerID).emit(signal, ...args);
  }

  sendOtherPlayers<E extends keyof ServerEvents>(
    playerID: ID,
    signal: E,
    ...args: Parameters<ServerEvents[E]>
  ) {
    // This is cluster-safe. It tells the redis-adapter to send the message
    // to everyone in the room `this.id` EXCEPT for the socket with `playerID`.
    this.io
      .to(this.id)
      .except(playerID)
      .emit(signal, ...args);
  }

  isPlayerTurn(playerID: string): boolean {
    return this.players[this.actIndex]?.id == playerID;
  }

  getCurrPlayer(): Player | undefined {
    return this.players[this.actIndex];
  }

  hasGameStarted(): boolean {
    return this.round > 0;
  }

  placeCard(tileID: tileID, cardVal: cardID, id: ID): Result<boolean> {
    const currPlayer = this.getCurrPlayer();
    if (!currPlayer || currPlayer.id != id) {
      this.sendPlayer(id as ID, "placeCardRej", tileID, cardVal);
      return {
        ok: false,
        error: `room.placeCard:not current player-currPlayer ${currPlayer?.id} player ${id} `,
      };
    }

    if (!currPlayer.hasCard(cardVal)) {
      this.sendPlayer(id as ID, "placeCardRej", tileID, cardVal);
      return { ok: false, error: "room.placeCard: not owning card" };
    }

    let res = this.board.placeCard(tileID, cardVal, id);
    if (res.ok) {
      currPlayer.discard(cardVal);
      this.deck.addDiscard(Card.fromKey(cardVal));
      let unit = res.val.unit;
      let serUnit = unit.toJSON();
      if (unit.faceup) {
        this.sendOtherPlayers(id, "placeCardPublic", currPlayer.publicID, tileID, serUnit);
      } else {
        this.sendOtherPlayers(id as ID, "placeCardPublic", currPlayer.publicID, tileID, {
          unitID: res.val.unit.id,
        });
      }
      this.sendPlayer(id as ID, "placeCardAck", tileID, cardVal, serUnit);
      return { ok: true, val: true };
    }
    this.sendPlayer(id as ID, "placeCardRej", tileID, cardVal);
    return { ok: false, error: res.error };
  }

  /*
  registerHandlers(socket: IOSocket<ClientEvents, ServerEvents>) {
    socket.on("disconnect", () => {
      const dcPlayer = this.players.find((pl) => pl.id == socket.id);
      if (dcPlayer) {
        this.sendRoom("dcPlayer", dcPlayer.publicID);
        if (this.isPlayerTurn(socket.id)) {
          this.advanceTurn();
        }
        this.actIndex--;
        this.players = this.players.filter((player) => player.id != socket.id);
        this.logger.info("A user disconnected:", socket.id);

        // If the room is now empty, stop the timer to prevent a crash
        if (this.players.length === 0 && this.turnTimer) {
          clearTimeout(this.turnTimer);
          this.turnTimer = null;
          this.logger.info("Room is empty, stopping turn timer.");
        }
      }
    });

    socket.on("submitTurn", () => {
      if (this.isPlayerTurn(socket.id)) {
        this.advanceTurn();
      }
    });

    socket.on("flip", (tileID: tileID, unitID: unitID) => {
      const currPlayer = this.getCurrPlayer();
      if (currPlayer && currPlayer.id == socket.id) {
        if (this.board.flipUnit(socket.id as ID, tileID, unitID)) {
          this.sendRoom("flipAck", currPlayer.publicID, tileID, unitID);
          this.startTurnTimer();
          return;
        }
      }
      this.sendPlayer(socket.id as ID, "flipRej", tileID, unitID);
    });

    socket.on("placeCard", (tileID: tileID, cardVal: cardID) => {
      const currPlayer = this.getCurrPlayer();
      if (currPlayer && currPlayer.id == socket.id && currPlayer.hasCard(cardVal)) {
        const card = Card.fromKey(cardVal);
        const unit = new Unit(card);
        let [success, unitSwallowed, unitID] = this.board.placeCard(
          tileID,
          unit,
          socket.id as ID
        );
        if (success) {
          currPlayer.discard(cardVal);
          this.deck.addDiscard(Card.fromKey(cardVal));
          if (unitSwallowed) {
            this.sendOtherPlayers(
              socket.id as ID,
              "placeCardPublic",
              currPlayer.publicID,
              tileID,

              {
                unitID: unitID,
                cardID: cardVal,
              }
            );
          } else {
            this.sendOtherPlayers(
              socket.id as ID,
              "placeCardPublic",
              currPlayer.publicID,
              tileID,
              {
                unitID: unitID,
              }
            );
          }
          this.sendPlayer(
            socket.id as ID,
            "placeCardAck",
            tileID,
            cardVal,
            unitID,
            unitSwallowed
          );
          this.startTurnTimer();
          return;
        }
      }
      this.sendPlayer(socket.id as ID, "placeCardRej", tileID, cardVal);
    });

    socket.on("buyCard", () => {
      const currPlayer = this.getCurrPlayer();
      if (currPlayer && currPlayer.id == socket.id && currPlayer.canBuyCard()) {
        const card = this.deck.deal(1)[0];
        if (card) {
          const fee = currPlayer.buyCard(card);
          this.pot += fee;
          this.sendOtherPlayers(
            currPlayer.id,
            "buyCardPublic",
            currPlayer.publicID
          );
          this.sendPlayer(currPlayer.id, "buyCardAck", card.toKey());
          return;
        }
      }
      this.sendPlayer(socket.id as ID, "buyCardRej");
    });
  }
  */
}
