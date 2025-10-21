import { playerDTO, selfDTO } from "./dto.js";
import { cardID, coins, publicID, tileID, unitID } from "./types.js";

export type ClientEvents = {
  flip: (tileID: tileID, unitID: unitID) => void;
  submitTurn: () => void;
  placeCard: (tileID: tileID, cardVal: cardID, bet: coins) => void;
  buyCard: () => void;
  joinGame: () => void;
};

export type ServerEvents = {
  flipAck: (publicID: publicID, tileID: tileID, unitID: unitID) => void;
  flipRej: (tileID: tileID, unitID: unitID) => void;
  yourTurn: (publicID: publicID, duration: number) => void;
  waitTurn: (publicID: publicID, duration: number) => void;
  winner: (publicID: publicID) => void;
  income: (amount: coins) => void;
  placeCardAck: (
    tileID: tileID,
    cardID: cardID,
    bet: coins,
    unitID: unitID,
    swallowed: boolean
  ) => void;
  placeCardPublic: (
    publicID: publicID,
    tileID: tileID,
    bet: coins,
    data: { unitID: unitID } | { unitID: unitID; cardID: cardID }
  ) => void;
  placeCardRej: (tileID: tileID, cardID: cardID, bet: coins) => void;
  buyCardPublic: (publicID: publicID) => void;
  buyCardAck: (cardVal: cardID) => void;
  buyCardRej: () => void;
  joinGameAck: (numPlayers: number) => void;
  gameStart: (playerList: playerDTO[], dto: selfDTO) => void;
  dcPlayer: (publicID: publicID) => void;
};
