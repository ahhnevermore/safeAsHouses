import * as PIXI from 'pixi.js';

// Create the PixiJS application
const app = new PIXI.Application({
  width: 600, // Adjust as needed
  height: 700,
  backgroundColor: 0x1099bb,
});
document.body.appendChild(app.view);

// Board settings
const boardSize = 9;
const tileSize = 50;
const boardOffsetX = 50;
const boardOffsetY = 50;

// Draw the board
for (let x = 0; x < boardSize; x++) {
  for (let y = 0; y < boardSize; y++) {
    const tile = new PIXI.Graphics();
    tile.lineStyle(2, 0x333333, 1);
    tile.beginFill(0xffffff);
    tile.drawRect(0, 0, tileSize, tileSize);
    tile.endFill();
    tile.x = boardOffsetX + x * tileSize;
    tile.y = boardOffsetY + y * tileSize;
    tile.interactive = true;
    tile.buttonMode = true;
    tile.on('pointerdown', () => {
      alert(`Tile clicked: (${x}, ${y})`);
    });
    app.stage.addChild(tile);
  }
}

// Placeholder for hand/cards area
const handArea = new PIXI.Graphics();
handArea.beginFill(0xeeeeee);
handArea.drawRect(0, 600, 600, 100);
handArea.endFill();
app.stage.addChild(handArea);

// You can later add sprites for cards, units, etc. here
