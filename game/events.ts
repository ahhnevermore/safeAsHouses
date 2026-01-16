import { playerDTO, selfDTO } from "./dto.js";
import { cardID, coins, publicID, roomID, tileID, unitID } from "./types.js";

export type ClientEvents = {
  joinGame: () => void;
  submitTurn: (roomID: roomID) => void;
  flip: (roomID: roomID, tileID: tileID, unitID: unitID) => void;
  placeCard: (roomID: roomID, tileID: tileID, cardVal: cardID) => void;
  buyCard: (roomID: roomID) => void;
};

export type ServerEvents = {
  flipAck: (publicID: publicID, tileID: tileID, unitID: unitID) => void;
  flipRej: (tileID: tileID, unitID: unitID) => void;
  yourTurn: (publicID: publicID, duration: number) => void;
  waitTurn: (publicID: publicID, duration: number) => void;
  winner: (publicID: publicID) => void;
  income: (amount: coins) => void;
  placeCardAck: (tileID: tileID, cardID: cardID, unitID: unitID, swallowed: boolean) => void;
  placeCardPublic: (
    publicID: publicID,
    tileID: tileID,
    data: { unitID: unitID } | { unitID: unitID; cardID: cardID }
  ) => void;
  placeCardRej: (tileID: tileID, cardID: cardID) => void;
  buyCardPublic: (publicID: publicID) => void;
  buyCardAck: (cardVal: cardID) => void;
  buyCardRej: () => void;
  raisePublic: (publicID: publicID, tileID: tileID, bet: coins) => void;
  raiseRej: (tileID: tileID, bet: coins) => void;
  joinGameAck: (numPlayers: number) => void;
  roundStart: (
    roomID: roomID,
    playerDTOs: playerDTO[],
    selfDTO: selfDTO,
    riverCards: cardID[],
    gameStart: boolean
  ) => void;
  dcPlayer: (publicID: publicID) => void;
};
