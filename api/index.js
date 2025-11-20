/**
 * WebRTC Signaling Server
 * 
 * This server provides WebRTC signaling functionality using Socket.IO.
 * 
 * What is Signaling?
 * - Signaling is the process of exchanging connection information between peers
 * - It's needed because WebRTC peers need to know how to reach each other
 * - This server acts as a "matchmaker" - it helps peers find each other
 * - Once peers are connected, media flows directly between them (P2P)
 * 
 * Server Responsibilities:
 * 1. Maintain WebSocket connections with clients
 * 2. Relay WebRTC signaling messages (offers/answers) between peers
 * 3. Handle user connections/disconnections
 * 
 * What this server does NOT do:
 * - Does NOT handle actual video/audio streams (that's peer-to-peer)
 * - Does NOT store or process media data
 * - Does NOT act as a media server
 */

// Import required modules
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const videoCallSocketHandler = require('./sockets/videoCallSocketHandler');

// Create Express app and HTTP server
// Note: Socket.IO requires an HTTP server, not just Express
const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
// This allows the React frontend to connect from different origins
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*', // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Enable connection state recovery for better reliability
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Middleware configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'WebRTC Signaling Server',
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Server status endpoint (for monitoring)
app.get('/status', (req, res) => {
  res.json({
    server: 'WebRTC Signaling Server',
    status: 'running',
    uptime: process.uptime(),
    connectedClients: io.engine.clientsCount,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Initialize WebRTC signaling handler
videoCallSocketHandler(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER] Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start the server
const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  console.log('='.repeat(50));
  console.log('🚀 WebRTC Signaling Server Started');
  console.log('='.repeat(50));
  console.log(`📍 Server running on: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log('='.repeat(50));
  console.log('\n💡 Educational Note:');
  console.log('   This server only handles SIGNALING (connection setup).');
  console.log('   Actual video/audio streams flow directly between peers (P2P).');
  console.log('='.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[SERVER] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[SERVER] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});
