require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const Board = require('./board');
const Player = require('./player');
const Deck = require('./deck');

// HTTPS certificate setup
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'server.crt');
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'server.key');
let credentials;
try {
  credentials = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
} catch (e) {
  console.error('Could not load SSL certificate or key:', e);
  process.exit(1);
}

const app = express();
const server = https.createServer(credentials, app);
const io = new Server(server);

// Redirect HTTP to HTTPS (always)
const httpApp = express();
httpApp.use((req, res) => {
  res.redirect('https://' + req.headers.host + req.url);
});
const httpServer = http.createServer(httpApp);
httpServer.listen(80, () => {
  console.log('HTTP server listening on port 80 and redirecting to HTTPS');
});

// Middleware to parse JSON
app.use(express.json());
app.use(cookieParser());

// Serve static files
app.use(express.static('public'));

// Database connection setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Migration runner
const runMigrations = async () => {
  try {
    // Ensure the migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get the list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    // Get the list of applied migrations
    const result = await pool.query('SELECT name FROM migrations');
    const appliedMigrations = new Set(result.rows.map(row => row.name));

    // Apply pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrations.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        await pool.query(sql);
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        console.log(`Applied migration: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error running migrations:', err);
  }
};

// Run migrations on server startup
runMigrations();


// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).send('Access Denied');
  // Audit logging helper

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = user;
    next();
  });
};

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper to generate a refresh token
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

async function logAudit(userId, event, details, req) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, event, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, event, details, req?.ip || null]
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}

// User registration endpoint
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)',
      [username, hashedPassword, email]
    );
    res.status(201).send('User registered');
  } catch (err) {
    res.status(500).send('Error registering user');
  }
});

// User login endpoint (with audit log)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await logAudit(user ? user.id : null, 'failed_login', `Username: ${username}`, req);
      return res.status(401).send('Invalid credentials');
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      expires: expiresAt
    });
    await logAudit(user.id, 'login', 'User logged in', req);
    res.json({ token });
  } catch (err) {
    res.status(500).send('Error logging in');
  }
});

// Token refresh endpoint
app.post('/token', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).send('No refresh token');
  try {
    const result = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()', [refreshToken]);
    const tokenRow = result.rows[0];
    if (!tokenRow) return res.status(403).send('Invalid refresh token');
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [tokenRow.user_id]);
    const user = userResult.rows[0];
    if (!user) return res.status(403).send('User not found');
    const newToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token: newToken });
  } catch (err) {
    res.status(500).send('Error refreshing token');
  }
});

// Logout endpoint (invalidate refresh token)
app.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    res.clearCookie('refreshToken');
  }
  res.send('Logged out');
});

// Request password reset endpoint (with audit log)
app.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).send('Email not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `Click the link to reset your password: ${resetLink}`,
    });
    await logAudit(user.id, 'request_password_reset', 'Password reset requested', req);
    res.send('Password reset email sent');
  } catch (err) {
    res.status(500).send('Error requesting password reset');
  }
});

// Reset password endpoint (with audit log and refresh token revocation)
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    const resetToken = result.rows[0];
    if (!resetToken) {
      return res.status(400).send('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetToken.id]);
    // Revoke all refresh tokens for this user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [resetToken.user_id]);
    await logAudit(resetToken.user_id, 'reset_password', 'Password was reset', req);
    res.send('Password has been reset');
  } catch (err) {
    res.status(500).send('Error resetting password');
  }
});

const board = new Board();
const players = {}; // Store players by their socket ID
const deck = new Deck();
deck.shuffle();

let currentTurn = 0; // Index of the current player's turn
const turnOrder = []; // Array to maintain the turn order

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Initialize player
  players[socket.id] = new Player(socket.id, `Player-${socket.id}`);

  // Add player to turn order
  turnOrder.push(socket.id);

  // Emit turn information to all players
  const emitTurnInfo = () => {
    io.emit('turnInfo', {
      currentPlayer: turnOrder[currentTurn],
      turnOrder,
    });
  };

  // Handle end of turn
  socket.on('endTurn', () => {
    if (socket.id === turnOrder[currentTurn]) {
      currentTurn = (currentTurn + 1) % turnOrder.length;
      emitTurnInfo();
    } else {
      socket.emit('error', 'Not your turn');
    }
  });

  // Handle tile click to show state and combat options
  socket.on('clickTile', ({ x, y }) => {
    const tile = board.grid[x][y];
    if (tile) {
      const combatants = turnOrder.map((playerId) => {
        const player = players[playerId];
        return {
          playerId,
          hand: player.hand,
        };
      });
      socket.emit('tileInfo', { tile, combatants });
    } else {
      socket.emit('tileInfo', { tile: null });
    }
  });

  socket.on('placeCard', ({ x, y, cardIndex }) => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      const card = player.hand[cardIndex];
      if (board.placeCard(x, y, card, player.id)) {
        player.hand.splice(cardIndex, 1); // Remove card from hand
        io.emit('updateBoard', board.grid);
      } else {
        socket.emit('error', 'Invalid placement');
      }
    } else {
      socket.emit('error', 'Not your turn');
    }
  });

  socket.on('moveUnit', ({ fromX, fromY, toX, toY }) => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      if (board.moveUnit(fromX, fromY, toX, toY, player.id)) {
        io.emit('updateBoard', board.grid);
      } else {
        socket.emit('error', 'Invalid move');
      }
    } else {
      socket.emit('error', 'Not your turn');
    }
  });

  socket.on('buyCard', () => {
    if (socket.id === turnOrder[currentTurn]) {
      const player = players[socket.id];
      const card = player.buyCard(deck);
      if (card) {
        socket.emit('updateHand', player.hand);
      } else {
        socket.emit('error', 'Not enough coins');
      }
    } else {
      socket.emit('error', 'Not your turn');
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    delete players[socket.id];

    // Remove player from turn order
    const index = turnOrder.indexOf(socket.id);
    if (index !== -1) {
      turnOrder.splice(index, 1);
      if (currentTurn >= turnOrder.length) {
        currentTurn = 0;
      }
      emitTurnInfo();
    }
  });

  // Emit initial turn info
  emitTurnInfo();
});

// Start the server
const PORT = process.env.PORT || 443;
server.listen(PORT, () => {
  console.log(`HTTPS server is running on https://localhost:${PORT}`);
});