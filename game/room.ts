import { Board } from "./board.js";
import { Card, Scope, TILE_COINS, Vec2, type ClientEvents, type ServerEvents } from "./util.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer, Socket as IOSocket } from "socket.io";
import { EventEmitter } from "events";
import { error } from "console";
import { Logger } from "winston";
import { Unit } from "./unit.js";


    this.deck = new Deck();
    this.board = new Board();
    this.id = "room-" + Room.nextID++;

    this.io = ioServer;
    this.logger = logger.child({ roomID: this.id });
  }


    socket.join(this.id);
    this.registerHandlers(socket);
    this.logger.info("A user connected:", socket.id);
  }


  }

  startGame() {
    this.startTurnTimer();
  }



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


    }
  }

  isPlayerTurn(playerID: string): boolean {
    return this.players[this.activeIndex]?.id == playerID;
  }

  registerHandlers(socket: IOSocket<ClientEvents, ServerEvents>) {
    socket.on("disconnect", () => {
      this.players = this.players.filter((player) => {
        player.id != socket.id;
        if (this.isPlayerTurn(socket.id)) {
          this.advanceTurn();
        }
      });

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
      if (this.isPlayerTurn(socket.id)) {
        const card = Card.fromKey(cardVal);
        const unit = new Unit(card);
        let [success, unitSwallowed, unitID] = this.board.placeCard(tileID, unit, socket.id, bet);
        if (success) {
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
  }
}
