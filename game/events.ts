export type ClientEvents = {
  flip: (tileID: string, unitID: number) => void;
  submitTurn: () => void;
  placeCard: (tileID: string, cardVal: string, bet: number) => void;
  buyCard: () => void;
  joinGame: () => void;
};

export type ServerEvents = {
  flipAck: (tileID: string, unitID: number, playerID: string) => void;
  flipRej: (tileID: string, unitID: number) => void;
  yourTurn: (playerIndex: number, duration: number) => void;
  waitTurn: (playerIndex: number, duration: number) => void;
  winner: (playerName: string) => void;
  income: (amount: number) => void;
  placeCardAck: (
    tileID: string,
    cardVal: string,
    bet: number,
    unitID: number,
    swallowed: boolean
  ) => void;
  placeCardPublic: (
    tileID: string,
    bet: number,
    data: { unitID: number } | { unitID: number; cardVal: string }
  ) => void;
  placeCardRej: (tileID: string, cardVal: string, bet: number) => void;
  buyCardPublic: () => void;
  buyCardAck: (cardVal: string) => void;
  buyCardRej: () => void;
  joinGameAck: (numPlayers: number) => void;
  gameStart: () => void;
  dcPlayer: (playerIndex: number) => void;
};
