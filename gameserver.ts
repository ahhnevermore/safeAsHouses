
  transports: [
    new wTransports.File({ filename: "app.log" }),
    new wTransports.Console(),
  ],
});

// Initialize Express app
const app = express();
app.set("trust proxy", 1);



// Middleware
app.use(express.json());


io.on("connection", (socket) => {
  const username = socket.handshake.auth.username || "Guest";


});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Game server is running on http://localhost:${PORT}`);
});
