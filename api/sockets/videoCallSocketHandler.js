/**
 * WebRTC Signaling Server Handler
 * 
 * This module handles WebRTC signaling via Socket.IO.
 * 
 * IMPORTANT: This server only handles SIGNALING (connection setup), NOT the actual media streams.
 * The actual video/audio data flows directly between peers using WebRTC (peer-to-peer).
 * 
 * Signaling Process:
 * 1. User A creates a WebRTC offer (connection proposal)
 * 2. Offer is sent to server via 'callUser' event
 * 3. Server forwards offer to User B via 'callUser' event
 * 4. User B creates a WebRTC answer
 * 5. Answer is sent to server via 'answerCall' event
 * 6. Server forwards answer to User A via 'callAccepted' event
 * 7. Once signaling is complete, peers establish direct WebRTC connection
 */
const videoCallSocketHandler = (io) => {
  // Track connected users for educational/debugging purposes
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log(`[SIGNALING] New client connected. Socket ID: ${socket.id}`);
    console.log(`[SIGNALING] Total connected users: ${io.engine.clientsCount}`);

    // Store user connection info
    connectedUsers.set(socket.id, {
      connectedAt: new Date().toISOString(),
      socketId: socket.id
    });

    /**
     * Send the client their own socket ID
     * This ID is used to identify users when making calls
     */
    socket.emit("me", socket.id);
    console.log(`[SIGNALING] Sent socket ID '${socket.id}' to client`);

    /**
     * Handle client disconnection
     * When a user disconnects, notify all other users that the call has ended
     */
    socket.on("disconnect", (reason) => {
      console.log(`[SIGNALING] Client disconnected. Socket ID: ${socket.id}, Reason: ${reason}`);
      console.log(`[SIGNALING] Remaining connected users: ${io.engine.clientsCount}`);
      
      // Remove from tracking
      connectedUsers.delete(socket.id);
      
      // Notify all other clients that this user's call has ended
      socket.broadcast.emit("callEnded", { disconnectedUserId: socket.id });
    });

    /**
     * Handle incoming call request (WebRTC Offer)
     * 
     * When User A wants to call User B:
     * 1. User A creates a Peer instance with initiator: true
     * 2. Peer generates an SDP offer (signal data)
     * 3. This signal is sent here via 'callUser' event
     * 4. We forward it to the target user (User B)
     * 
     * @param {Object} data - Call request data
     * @param {string} data.userToCall - Socket ID of the user being called
     * @param {Object} data.signalData - WebRTC SDP offer signal
     * @param {string} data.from - Socket ID of the caller
     * @param {string} data.name - Name of the caller
     */
    socket.on("callUser", ({ userToCall, signalData, from, name }) => {
      console.log(`[SIGNALING] Call request from ${from} (${name}) to ${userToCall}`);
      
      // Validate that target user exists
      if (!io.sockets.sockets.has(userToCall)) {
        console.warn(`[SIGNALING] Warning: Attempted to call non-existent user ${userToCall}`);
        socket.emit("callError", { message: "User not found or disconnected" });
        return;
      }

      // Forward the call request (offer) to the target user
      io.to(userToCall).emit("callUser", { 
        signal: signalData, 
        from, 
        name 
      });
      
      console.log(`[SIGNALING] Forwarded call offer from ${from} to ${userToCall}`);
    });

    /**
     * Handle call answer (WebRTC Answer)
     * 
     * When User B accepts the call:
     * 1. User B creates a Peer instance with initiator: false
     * 2. Peer generates an SDP answer (signal data)
     * 3. This signal is sent here via 'answerCall' event
     * 4. We forward it back to the original caller (User A)
     * 
     * @param {Object} data - Answer data
     * @param {Object} data.signal - WebRTC SDP answer signal
     * @param {string} data.to - Socket ID of the original caller
     */
    socket.on("answerCall", (data) => {
      const { to, signal } = data;
      console.log(`[SIGNALING] Call accepted. Forwarding answer from ${socket.id} to ${to}`);
      
      // Validate that caller still exists
      if (!io.sockets.sockets.has(to)) {
        console.warn(`[SIGNALING] Warning: Attempted to answer call from non-existent user ${to}`);
        socket.emit("callError", { message: "Caller disconnected" });
        return;
      }

      // Forward the answer back to the original caller
      io.to(to).emit("callAccepted", signal);
      console.log(`[SIGNALING] Forwarded call answer to ${to}`);
    });

    /**
     * Handle connection errors
     */
    socket.on("error", (error) => {
      console.error(`[SIGNALING] Socket error for ${socket.id}:`, error);
    });
  });

  // Log server status periodically (for educational purposes)
  setInterval(() => {
    console.log(`[SIGNALING] Server status - Connected users: ${io.engine.clientsCount}`);
  }, 30000); // Every 30 seconds
};

module.exports = videoCallSocketHandler;
