import * as PIXI from "pixi.js";
import { unitID } from "../../game/types.js";
import { unitDTO } from "../../game/dto.js";

export class UIUnit extends PIXI.Container {
  model: unitDTO | null = null;
  canMove: boolean = false;
  constructor() {
    super();
  }

  show(dto: unitDTO) {
    this.model = dto;
  }
}
