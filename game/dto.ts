import { cardID, colour, publicID } from "./types.js";

export class playerDTO {
  id: publicID = "" as publicID;
  name: string = "Guest";
  handSize: number = 0;
  colour?: colour;
  territory: number = 1;
  coins: number = 0;
}

export class selfDTO {
  id: publicID = "" as publicID;
  name: string = "Guest";
  hand: cardID[] = [];
}
