import { Assets } from "pixi.js";
import crownURL from "./assets/images/crown.png";
import castleIcon from "./assets/images/castleIcon.png";
import coinsIcon from "./assets/images/coinIcon.png";
import incomeIcon from "./assets/images/incomeIcon.png";
import cardsIcon from "./assets/images/cardsIcon.png";
import gameBoard from "./assets/images/gameBoard.png";
import baseUnit from "./assets/images/baseUnit.png";
import jackOverlay from "./assets/images/jackOverlay.png";
import aceOverlay from "./assets/images/aceOverlay.png";
import queenOverlay from "./assets/images/queenOverlay.png";
import kingOverlay from "./assets/images/kingOverlay.png";

export const ASSETS = {
  crown: crownURL,
  castleIcon: castleIcon,
  coinsIcon: coinsIcon,
  cardsIcon: cardsIcon,
  incomeIcon: incomeIcon,
  gameBoard: gameBoard,
  baseUnit: baseUnit,
  aceOverlay: aceOverlay,
  jackOverlay: jackOverlay,
  queenOverlay: queenOverlay,
  kingOverlay: kingOverlay,
};

export async function loadAssets() {
  await Assets.load(Object.values(ASSETS));
}
