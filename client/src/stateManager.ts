import * as PIXI from "pixi.js";
import { ClientEvents, ServerEvents } from "../../game/events.js";
import { ClientState } from "../../game/util.js";
import { Socket } from "socket.io-client";
import { MainMenuState, MMSig } from "./mainMenu.js";
import { LobbyState } from "./lobby.js";
import { GameState } from "./game.js";
import { VictoryState, VSig } from "./victory.js";

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

  registerGameHandlers(g: GameState) {}
  registerLobbyHandlers(l: LobbyState) {}
  registerMainMenuHandlers(m: MainMenuState) {
    m.on(MMSig.Join, () => this.joinGame());
  }
  registerVictoryHandlers(v: VictoryState) {
    v.on(VSig.Back, () => this.changeState(ClientState.MainMenu));
  }

  changeState(clientState: ClientState, props?: Record<string, unknown>) {
    if (this.actState) {
      this.app.stage.removeChild(this.actState.container);
      this.actState.exit();
    }
    let newState: IState;
    switch (clientState) {
      case ClientState.MainMenu:
        newState = this.mainMenu;
        break;
      case ClientState.Lobby:
        newState = this.lobby;
        break;
      case ClientState.Game:
        newState = this.game;
        break;
      case ClientState.Victory:
        newState = this.victory;
        break;
    }
    this.actState = newState;
    this.app.stage.addChild(newState.container);
    newState.enter(props);
  }

  joinGame() {
    this.socket.emit("joinGame");
  }

  registerHandlers(socket: Socket<ServerEvents, ClientEvents>) {
    socket.on("joinGameAck", (numPlayers) =>
      this.changeState(ClientState.Lobby, { actPlayers: numPlayers })
    );

    socket.on("roundStart", (playerDTOs, selfDTO, riverCards, gameStart) => {
      this.changeState(ClientState.Game);
      if (gameStart) {
        this.game.initializeGame(playerDTOs, selfDTO, riverCards);
      }
    });

    socket.on("yourTurn", (publicID, duration) => {
      this.game.updateMyTurn(true, publicID, duration);
    });

    socket.on("waitTurn", (playerIndex, duration) =>
      this.game.updateMyTurn(false, playerIndex, duration)
    );
  }
}
