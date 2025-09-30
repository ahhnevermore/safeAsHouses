export class playerDTO {
  id: string = "";
  name: string = "Guest";
  handSize: number = 0;
  colour?: number;
  territory: number = 1;
  coins: number = 0;
}

export class selfDTO {
  id: string = "";
  name: string = "Guest";
  hand: string[] = [];
}
