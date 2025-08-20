// Connect to the Socket.IO server
const socket = io();

// Game state
let gameState = {
  board: [],
  players: {},
  currentPlayer: null,
  turnOrder: [],
  myHand: []
};

// DOM elements
const statusElement = document.getElementById('status');
const playersElement = document.getElementById('players');
const gameContainer = document.getElementById('game-container');
const endTurnButton = document.getElementById('end-turn');
const buyCardButton = document.getElementById('buy-card');

// Board settings
const boardSize = 9;
const tileSize = 50;
const boardOffsetX = 20;
const boardOffsetY = 20;

// Initialize the game board
function initializeBoard() {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = boardSize * tileSize + 2 * boardOffsetX;
  canvas.height = boardSize * tileSize + 2 * boardOffsetY;
  gameContainer.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  
  // Draw the initial board
  drawBoard(ctx);
  
  // Handle clicks on the board
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - boardOffsetX) / tileSize);
    const y = Math.floor((event.clientY - rect.top - boardOffsetY) / tileSize);
    
    if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
      handleTileClick(x, y);
    }
  });
}

// Draw the game board
function drawBoard(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // Draw background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // Draw tiles
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      drawTile(ctx, x, y);
    }
  }
  
  // Highlight the river position
  const riverX = 5;
  const riverY = 5;
  ctx.strokeStyle = '#00BFFF';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    boardOffsetX + riverX * tileSize, 
    boardOffsetY + riverY * tileSize, 
    tileSize, 
    tileSize
  );
}

// Draw a single tile
function drawTile(ctx, x, y) {
  const tileX = boardOffsetX + x * tileSize;
  const tileY = boardOffsetY + y * tileSize;
  
  // Default tile style
  ctx.fillStyle = '#3a3a3a';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  
  // Check if we have data for this tile
  if (gameState.board[x] && gameState.board[x][y]) {
    const tile = gameState.board[x][y];
    if (tile.owner) {
      // Color the tile based on the owner
      const playerColors = ['#4CAF50', '#f44336', '#2196F3', '#FFC107'];
      const playerIndex = gameState.turnOrder.indexOf(tile.owner);
      if (playerIndex >= 0) {
        ctx.fillStyle = playerColors[playerIndex % playerColors.length];
      }
    }
  }
  
  // Draw the tile
  ctx.fillRect(tileX, tileY, tileSize, tileSize);
  ctx.strokeRect(tileX, tileY, tileSize, tileSize);
  
  // Draw coordinates for debugging
  ctx.fillStyle = '#aaa';
  ctx.font = '10px Arial';
  ctx.fillText(`${x},${y}`, tileX + 2, tileY + 10);
}

// Handle tile clicks
function handleTileClick(x, y) {
  console.log(`Clicked tile: (${x}, ${y})`);
  
  // Send click to server
  socket.emit('clickTile', { x, y });
  
  // If player has a card selected, attempt to place it
  if (selectedCardIndex !== null) {
    placeSelectedCard(x, y);
  }
}

// Update the players display
function updatePlayersDisplay() {
  playersElement.innerHTML = '';
  
  gameState.turnOrder.forEach(playerId => {
    const player = gameState.players[playerId];
    const isCurrentPlayer = playerId === gameState.currentPlayer;
    const isMe = playerId === socket.id;
    
    const playerDiv = document.createElement('div');
    playerDiv.className = `player ${isCurrentPlayer ? 'current-player' : ''}`;
    playerDiv.innerHTML = `
      <div>${isMe ? 'You' : player?.name || 'Player'}</div>
      <div>Coins: ${player?.coins || 0}</div>
      <div>Cards: ${player?.hand?.length || 0}</div>
    `;
    
    playersElement.appendChild(playerDiv);
  });
}

// Update the status display
function updateStatus() {
  if (gameState.currentPlayer === socket.id) {
    statusElement.textContent = 'Your turn!';
    endTurnButton.disabled = false;
    buyCardButton.disabled = false;
  } else {
    const currentPlayerName = gameState.players[gameState.currentPlayer]?.name || 'Another player';
    statusElement.textContent = `${currentPlayerName}'s turn...`;
    endTurnButton.disabled = true;
    buyCardButton.disabled = true;
  }
}

// Display the player's hand
let selectedCardIndex = null;

function updateHandDisplay() {
  const handContainer = document.createElement('div');
  handContainer.className = 'hand';
  handContainer.style.display = 'flex';
  handContainer.style.justifyContent = 'center';
  handContainer.style.marginTop = '20px';
  
  // Clear any existing hand display
  const existingHand = document.querySelector('.hand');
  if (existingHand) {
    existingHand.remove();
  }
  
  gameState.myHand.forEach((card, index) => {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${selectedCardIndex === index ? 'selected' : ''}`;
    cardElement.style.width = '40px';
    cardElement.style.height = '60px';
    cardElement.style.margin = '0 5px';
    cardElement.style.backgroundColor = getCardColor(card.suit);
    cardElement.style.color = 'white';
    cardElement.style.display = 'flex';
    cardElement.style.justifyContent = 'center';
    cardElement.style.alignItems = 'center';
    cardElement.style.border = `2px solid ${selectedCardIndex === index ? '#fff' : '#333'}`;
    cardElement.style.borderRadius = '5px';
    cardElement.style.cursor = 'pointer';
    cardElement.textContent = getCardValue(card.rank);
    
    cardElement.addEventListener('click', () => {
      if (gameState.currentPlayer === socket.id) {
        selectedCardIndex = selectedCardIndex === index ? null : index;
        updateHandDisplay();
      }
    });
    
    handContainer.appendChild(cardElement);
  });
  
  gameContainer.parentNode.insertBefore(handContainer, gameContainer.nextSibling);
}

// Place the selected card
function placeSelectedCard(x, y) {
  if (selectedCardIndex !== null && gameState.currentPlayer === socket.id) {
    socket.emit('placeCard', { x, y, cardIndex: selectedCardIndex });
    selectedCardIndex = null;
    updateHandDisplay();
  }
}

// Helper functions for cards
function getCardColor(suit) {
  const colors = ['#000000', '#ff0000', '#00aa00', '#0000ff'];
  return colors[suit] || '#666666';
}

function getCardValue(rank) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return rank.toString();
}

// Socket event listeners
socket.on('connect', () => {
  console.log('Connected to server');
  statusElement.textContent = 'Connected! Waiting for other players...';
});

socket.on('turnInfo', (data) => {
  gameState.currentPlayer = data.currentPlayer;
  gameState.turnOrder = data.turnOrder;
  
  updateStatus();
  updatePlayersDisplay();
});

socket.on('updateBoard', (boardData) => {
  gameState.board = boardData;
  const ctx = gameContainer.querySelector('canvas').getContext('2d');
  drawBoard(ctx);
});

socket.on('tileInfo', (data) => {
  console.log('Tile info:', data);
  // You could show a modal or tooltip with this information
});

socket.on('updateHand', (handData) => {
  gameState.myHand = handData;
  updateHandDisplay();
});

socket.on('error', (message) => {
  console.error('Game error:', message);
  statusElement.textContent = `Error: ${message}`;
  setTimeout(() => updateStatus(), 3000);
});

// Button event listeners
endTurnButton.addEventListener('click', () => {
  if (gameState.currentPlayer === socket.id) {
    socket.emit('endTurn');
  }
});

buyCardButton.addEventListener('click', () => {
  if (gameState.currentPlayer === socket.id) {
    socket.emit('buyCard');
  }
});

// Initialize the game
initializeBoard();
