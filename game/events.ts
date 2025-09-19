import { playerDTO, selfDTO } from "./dto.js";

export type ClientEvents = {
  flip: (tileID: string, unitID: number) => void;
  submitTurn: () => void;
  placeCard: (tileID: string, cardVal: string, bet: number) => void;
  buyCard: () => void;
  joinGame: () => void;
};

export type ServerEvents = {
  flipAck: (publicID: string, tileID: string, unitID: number) => void;
  flipRej: (tileID: string, unitID: number) => void;
  yourTurn: (publicID: string, duration: number) => void;
  waitTurn: (publicID: string, duration: number) => void;
  winner: (publicID: string) => void;
  income: (amount: number) => void;
  placeCardAck: (
    tileID: string,
    cardVal: string,
    bet: number,
    unitID: number,
    swallowed: boolean
  ) => void;
  placeCardPublic: (
    publicID: string,
    tileID: string,
    bet: number,
    data: { unitID: number } | { unitID: number; cardVal: string }
  ) => void;
  placeCardRej: (tileID: string, cardVal: string, bet: number) => void;
  buyCardPublic: (publicID: string) => void;
  buyCardAck: (cardVal: string) => void;
  buyCardRej: () => void;
  joinGameAck: (numPlayers: number) => void;
  gameStart: (playerList: playerDTO[], dto: selfDTO) => void;
  dcPlayer: (publicID: string) => void;
};
