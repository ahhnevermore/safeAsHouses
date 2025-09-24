import { Assets } from "pixi.js";
import crownURL from "./assets/images/crown.png";

export const ASSETS = {
  crown: crownURL,
  // add more as needed...
};

export async function loadAssets() {
  await Assets.load(Object.values(ASSETS));
}
