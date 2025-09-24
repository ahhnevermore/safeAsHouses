import * as PIXI from "pixi.js";
import { ClientEvents, ServerEvents } from "../../game/events.js";
import { ClientState } from "../../game/util.js";
import { Socket } from "socket.io-client";
import { MainMenuState } from "./mainMenu.js";
import { LobbyState } from "./lobby.js";
import { GameState } from "./game.js";
import { VictoryState } from "./victory.js";

export interface IState {
  container: PIXI.Container;
  enter(props?: Record<string, unknown>): void;
  exit(): void;
}

export class StateManager {
  private app: PIXI.Application;
  private socket: Socket<ServerEvents, ClientEvents>;
  private currentState: IState;
  mainMenu: MainMenuState;
  lobby: LobbyState;
  game: GameState;
  victory: VictoryState;

  constructor(app: PIXI.Application, socket: Socket<ServerEvents, ClientEvents>) {
    this.app = app;
    this.socket = socket;
    this.registerHandlers(socket);
    this.victory = new VictoryState(this);
    this.game = new GameState(this);
    this.lobby = new LobbyState(this);
    this.mainMenu = new MainMenuState(this);
    this.currentState = this.mainMenu;
    this.changeState(ClientState.MainMenu);
  }

  changeState(clientState: ClientState, props?: Record<string, unknown>) {
    if (this.currentState) {
      this.app.stage.removeChild(this.currentState.container);
      this.currentState.exit();
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
    this.currentState = newState;
    this.app.stage.addChild(newState.container);
    newState.enter(props);
  }

  joinGame() {
    this.socket.emit("joinGame");
  }

  registerHandlers(socket: Socket<ServerEvents, ClientEvents>) {
    socket.on("joinGameAck", (numPlayers) =>
      this.changeState(ClientState.Lobby, { currentPlayers: numPlayers })
    );

    socket.on("gameStart", (playerDTOs, selfDTO) => {
      this.changeState(ClientState.Game);
      this.game.initializeGame(playerDTOs, selfDTO);
    });

    socket.on("yourTurn", (publicID, duration) => {
      this.game.updateMyTurn(true, publicID, duration);
    });

    socket.on("waitTurn", (playerIndex, duration) =>
      this.game.updateMyTurn(false, playerIndex, duration)
    );
  }
}
