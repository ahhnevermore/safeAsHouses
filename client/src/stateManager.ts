import * as PIXI from "pixi.js";
import { ClientEvents, ServerEvents } from "../../game/events.js";
import { ClientState } from "../../game/util.js";
import { Socket } from "socket.io-client";
import { MainMenuState, MMSig } from "./mainMenu.js";
import { LobbyState } from "./lobby.js";
import { GameState, GSig } from "./game.js";
import { VictoryState, VSig } from "./victory.js";
import { cardID, roomID, tileID } from "../../game/types.js";

export interface IState {
  container: PIXI.Container;
  enter(props?: Record<string, unknown>): void;
  exit(): void;
}

export class StateManager {
  private app: PIXI.Application;
  private socket: Socket<ServerEvents, ClientEvents>;
  private actState: IState;
  mainMenu: MainMenuState;
  lobby: LobbyState;
  game: GameState;
  victory: VictoryState;

  constructor(app: PIXI.Application, socket: Socket<ServerEvents, ClientEvents>) {
    this.app = app;
    this.socket = socket;
    this.registerHandlers(socket);

    const v = new VictoryState();
    this.registerVictoryHandlers(v);
    this.victory = v;

    const g = new GameState();
    this.registerGameHandlers(g);
    this.game = g;

    const l = new LobbyState();
    this.registerLobbyHandlers(l);
    this.lobby = l;

    const m = new MainMenuState();
    this.registerMainMenuHandlers(m);
    this.mainMenu = m;

    this.actState = this.mainMenu;
    this.changeState(ClientState.MainMenu);
  }

  registerGameHandlers(g: GameState) {
    // Listeners are now registered dynamically in changeState
  }
  registerLobbyHandlers(l: LobbyState) {}
  registerMainMenuHandlers(m: MainMenuState) {
    m.on(MMSig.Join, () => {
      const username = `Player_${Math.random().toString(36).substring(7)}`;
      this.socket.emit("joinGame", username);
    });
  }
  registerVictoryHandlers(v: VictoryState) {
    v.on(VSig.Back, () => this.changeState(ClientState.MainMenu));
  }

  changeState(newState: ClientState, props?: any) {
    if (this.actState) {
      if (this.actState == this.game) {
        this.game.removeAllListeners();
      }
      this.app.stage.removeChild(this.actState.container);
    }

    switch (newState) {
      case ClientState.MainMenu:
        this.actState = this.mainMenu;
        this.mainMenu.enter();
        break;
      case ClientState.Lobby:
        this.actState = this.lobby;
        this.lobby.enter({ actPlayers: props.numPlayers });
        break;
      case ClientState.Game:
        const g = this.game;
        g.on(GSig.Add, (c: cardID, t: tileID) => {
          this.socket.emit("placeCard", t, c);
        });
        g.on(GSig.Submit, () => {
          this.socket.emit("submitTurn");
        });
        this.actState = this.game;
        break;
      case ClientState.Victory:
        this.actState = this.victory;
        this.victory.enter();
        break;
    }
    this.app.stage.addChild(this.actState.container);
  }

  registerHandlers(socket: Socket<ServerEvents, ClientEvents>) {
    socket.on("joinGameAck", (numPlayers: number) => {
      if (this.actState === this.lobby) {
        this.lobby.setPlayers(numPlayers);
      } else {
        this.changeState(ClientState.Lobby, { numPlayers });
      }
    });

    socket.on("roundStart", (playerDTOs, selfDTO, riverCards, gameStart) => {
      this.changeState(ClientState.Game);
      this.game.initializeGame(playerDTOs, selfDTO, riverCards);
    });

    socket.on("yourTurn", (publicID, duration) => {
      this.game.updateMyTurn(true, publicID, duration);
    });

    socket.on("waitTurn", (playerIndex, duration) =>
      this.game.updateMyTurn(false, playerIndex, duration),
    );

    socket.on("disconnect", (reason) => {
      // Regardless of the reason, if we're not on the main menu, we should return there.
      if (this.actState !== this.mainMenu) {
        this.changeState(ClientState.MainMenu);
      }

      socket.on("placeCardAck", (tileId, cardID, serUnit) => {
        this.game.placeCardAck(tileId, cardID, serUnit);
      });

      // Now, display the appropriate notification on the main menu.
      if (reason === "io server disconnect") {
        // This is a graceful shutdown initiated by the server (e.g., for an update).
        this.mainMenu.setNotification("Server is updating, please try again shortly.");
      } else {
        // This could be a network issue or an unexpected server crash.
        this.mainMenu.setNotification("Connection lost. Please check your network.");
      }
    });
  }
}
