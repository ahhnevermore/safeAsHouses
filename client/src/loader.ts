import { Assets } from "pixi.js";
import crownURL from "./assets/images/crown.png";
import castleIcon from "./assets/images/castleIcon.png";
import coinsIcon from "./assets/images/coinIcon.png";
import incomeIcon from "./assets/images/incomeIcon.png";
import cardsIcon from "./assets/images/cardsIcon.png";

export const ASSETS = {
  crown: crownURL,
  castleIcon: castleIcon,
  coinsIcon: coinsIcon,
  cardsIcon: cardsIcon,
  incomeIcon: incomeIcon,

  // add more as needed...
};

export async function loadAssets() {
  await Assets.load(Object.values(ASSETS));
}
