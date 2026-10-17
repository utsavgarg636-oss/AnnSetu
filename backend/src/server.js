const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { waitForDb } = require('./config/db');
const { registerSurpriseFeature } = require('./plugins/surpriseFeatureSlot');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Store io on the app for route handlers
app.set('io', io);

// ─── Mount Routes ─────────────────────────────────────────
const adminRoutes = require('./routes/adminRoutes');
const hostRoutes = require('./routes/hostRoutes');
const ngoRoutes = require('./routes/ngoRoutes');

app.use('/api/admin', adminRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/ngo', ngoRoutes);

// ─── Initialize Extensibility Hook ───────────────────────
const featureSlot = registerSurpriseFeature(app, io);

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AnnSetu Backend',
    version: '1.0.0'
  });
});

// ─── Socket.io Connection Handling ────────────────────────
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`🔌 Client connected: ${socket.id} (${connectedClients} total)`);

  // Dashboard room subscription
  socket.on('join:dashboard', (dashboard) => {
    socket.join(dashboard);
    console.log(`📊 ${socket.id} joined ${dashboard} dashboard`);
  });

  // Broadcast connection count
  io.emit('clients:count', connectedClients);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`❌ Client disconnected: ${socket.id} (${connectedClients} total)`);
    io.emit('clients:count', connectedClients);
  });
});

// ─── Start Server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

waitForDb().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║       🍚 AnnSetu (अन्नसेतु) Backend Server       ║
  ║           Running on port ${PORT}                    ║
  ║       Real-time Socket.io: ✅ Active               ║
  ║       Database: SQLite ✅ Initialized              ║
  ║       API Docs: http://localhost:${PORT}/api/health  ║
  ╚═══════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
