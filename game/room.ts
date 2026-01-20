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
  Vec2,
} from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer, Socket as IOSocket } from "socket.io";
import { EventEmitter } from "events";
import { Logger } from "winston";
import { Unit } from "./unit.js";
import { cardID, coins, ID, publicID, roomID, tileID, unitID } from "./types.js";
import { playerDTO } from "./dto.js";

export class Room extends EventEmitter {
  private static nextID = 1;
  pot: number = 0;
  deck: Deck;
  board: Board;
  id: roomID;
  players: Player[] = [];
  actIndex: number = 0;
  turnTimer: NodeJS.Timeout | null = null;
  turnDuration: number = 30000;
  public gameStarted: boolean = false;

  io: IOServer<ClientEvents, ServerEvents>;
  logger: Logger;

  constructor(
    ioServer: IOServer<ClientEvents, ServerEvents>,
    logger: Logger,
    initialize: boolean = true,
  ) {
    super();
    this.io = ioServer;
    this.logger = logger;

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

  static deserialize(
    json: string,
    ioServer: IOServer<ClientEvents, ServerEvents>,
    logger: Logger,
  ): Room {
    const data = JSON.parse(json);
    const room = new Room(ioServer, logger, false);

    room.id = data.id;
    room.pot = data.pot;
    room.actIndex = data.actIndex;
    room.gameStarted = data.gameStarted || false; // Default to false if missing

    room.deck = Deck.fromJSON(data.deck);
    room.board = Board.fromJSON(data.board);
    room.players = data.players.map((p: any) => Player.fromJSON(p));

    return room;
  }

  addPlayer(userId: ID, name: string): number {
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

    // If it's this player's turn, send them the turn notification
    if (this.isPlayerTurn(userId)) {
      this.sendPlayer(userId, "yourTurn", player.publicID, this.turnDuration);
    } else {
      const actPlayer = this.getCurrPlayer();
      if (actPlayer) {
        this.sendPlayer(userId, "waitTurn", actPlayer.publicID, this.turnDuration);
      }
    }
  }

  isRoomFull() {
    return this.players.length == PLAYER_COUNT;
  }

  startGame() {
    this.gameStarted = true;
    this.startRound();
  }
  startRound() {
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
    this.startTurnTimer();
  }

  startTurnTimer() {
    try {
      const actPlayer = this.players[this.actIndex];

      this.sendPlayer(actPlayer.id, "yourTurn", actPlayer.publicID, this.turnDuration);
      this.sendOtherPlayers(actPlayer.id, "waitTurn", actPlayer.publicID, this.turnDuration);

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
    this.actIndex = (this.actIndex + 1) % this.players.length;
    const winner = this.board.checkRiverWin();
    if (winner) {
      const winningPlayer = this.players.find((pl) => pl.id == winner);
      if (winningPlayer) {
        this.sendRoom("winner", winningPlayer.publicID);
      }
    }
    const income = this.board.calculateIncome(this.players.map((pl) => pl.id));
    for (const [playerID, count] of Object.entries(income)) {
      this.sendPlayer(playerID as ID, "income", (count * TILE_COINS) as coins);
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
