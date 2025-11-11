import { cardID, colour, publicID, unitID } from "./types.js";

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

export class unitDTO {
  id: unitID = 0 as unitID;
  owner: publicID = "" as publicID;
  stack: cardID[] = [];
  faceup: boolean = false;
  canMove: boolean = false;
}
