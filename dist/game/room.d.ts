import { Board } from "./board.js";
import { Deck } from "./deck.js";
import { Player } from "./player.js";
import { Server as IOServer } from "socket.io";
export declare class Room {
    deck: Deck;
    board: Board;
    id: string | null;
    players: Player[];
    activeIndex: number;
    turnDuration: number;
    turnTimer: NodeJS.Timeout | null;
    constructor(id: string, players?: Player[]);
    addPlayer(socketId: string, name: string): Player;
    removePlayer(socketId: string): void;
    startGamePred(): boolean;
    startGame(io: IOServer): void;
    startTurn(io: IOServer): void;
    refreshTurnTimer(io: IOServer): void;
    advanceTurn(io: IOServer): void;
    submitTurn(io: IOServer, event: string): void;
}
//# sourceMappingURL=room.d.ts.map