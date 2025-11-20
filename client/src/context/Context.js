/**
 * WebRTC Video Chat - React Context Provider
 * 
 * This context manages all WebRTC and Socket.IO state for the video chat application.
 * 
 * KEY CONCEPTS:
 * 
 * 1. SIGNALING (Socket.IO):
 *    - Used to exchange connection information between peers
 *    - Helps peers find each other and establish connection
 *    - Does NOT transmit actual video/audio data
 * 
 * 2. WEBRTC (simple-peer):
 *    - Creates peer-to-peer connections for media streaming
 *    - Once connected, video/audio flows directly between browsers
 *    - Requires signaling to exchange connection offers/answers
 * 
 * 3. MEDIA STREAMS:
 *    - Local stream: Your own camera/microphone
 *    - Remote stream: The other person's camera/microphone
 * 
 * FLOW:
 * 1. Connect to Socket.IO server → Get socket ID
 * 2. Get local media stream (getUserMedia)
 * 3. Create Peer instance when calling/answering
 * 4. Exchange signals via Socket.IO
 * 5. Establish WebRTC connection
 * 6. Receive remote stream and display
 */

import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';

const SocketContext = createContext();

// Connect to the signaling server
// This connection is used ONLY for signaling, not for media
// Note: process.env is injected by Create React App at build time
// In development, if not set, default to localhost:3001
const getServerUrl = () => {
  // Safely access process.env (may not be available in all contexts)
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }
  // Default to localhost:3001 for development
  return 'http://13.36.208.154:3001';
};

const SERVER_URL = getServerUrl();
const socket = io.connect(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
});

const ContextProvider = ({ children }) => {
  // Call state
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [call, setCall] = useState({});
  
  // Media streams
  const [stream, setStream] = useState(null); // Local stream (your camera/mic)
  const [userStream, setUserStream] = useState(null); // Remote stream (other person's camera/mic)
  
  // User info
  const [name, setName] = useState('');
  const [me, setMe] = useState(''); // Socket ID (used to identify this user)
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [isCalling, setIsCalling] = useState(false);
  
  // Legacy refs (kept for backward compatibility)
  const [loadMyCamera, setLoadMyCamera] = useState(null);
  const myVideo = useRef();
  const userVideo = useRef();
  
  // WebRTC peer connection reference
  const connectionRef = useRef(null);
  
  // Track if socket is already initialized (prevents duplicate listeners during hot reload)
  const socketInitializedRef = useRef(false);
  
  // Refs to track call state (for use in socket event handlers to avoid stale closures)
  const callAcceptedRef = useRef(callAccepted);
  const callRef = useRef(call);
  const userStreamRef = useRef(userStream);
  
  // Update refs when state changes
  useEffect(() => {
    callAcceptedRef.current = callAccepted;
  }, [callAccepted]);
  
  useEffect(() => {
    callRef.current = call;
  }, [call]);
  
  useEffect(() => {
    userStreamRef.current = userStream;
  }, [userStream]);

  /**
   * Initialize Socket.IO connection and set up event listeners
   * This runs once when the component mounts
   */
  useEffect(() => {
    // Only initialize if not already done (prevent duplicate listeners during hot reload)
    if (!socketInitializedRef.current) {
      initializeSocket();
      socketInitializedRef.current = true;
    }
    
    // Check for socket ID if socket is already connected
    // This handles cases where socket connected before listeners were set up
    const checkForSocketId = () => {
      if (socket.connected && socket.id) {
        console.log('[CONTEXT] 📍 Socket ID available:', socket.id);
        setMe(socket.id);
        setConnectionStatus('connected');
        return true; // ID found
      }
      return false; // ID not found yet
    };
    
    // Check immediately
    checkForSocketId();
    
    // Also check periodically for a short time (handles race conditions)
    // This ensures we get the ID even if the socket connected very quickly
    const intervalId = setInterval(() => {
      if (checkForSocketId()) {
        // ID found, stop checking
        clearInterval(intervalId);
      }
    }, 200);
    
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
    }, 3000);
    
    // Cleanup on unmount
    return () => {
      // Clear any intervals/timeouts
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      
      // During hot reload, just remove listeners (socket stays connected)
      // On actual unmount, do full cleanup
      if (typeof module !== 'undefined' && module.hot) {
        // Hot reload - just remove listeners to prevent duplicates
        socket.removeAllListeners();
        socketInitializedRef.current = false;
      } else {
        // Actual unmount - full cleanup
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Internal function to handle call cleanup
   */
  const handleCallEnd = useCallback(() => {
    setCallEnded(true);
    setCallAccepted(false);
    setIsCalling(false);
    
    try {
      // Destroy WebRTC peer connection
      if (connectionRef.current) {
        console.log('[CONTEXT] Destroying peer connection...');
        connectionRef.current.destroy();
        connectionRef.current = null;
      }

      // Stop local media tracks (camera/microphone)
      if (stream) {
        console.log('[CONTEXT] Stopping local media tracks...');
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log('[CONTEXT] Stopped track:', track.kind);
        });
      }

      // Stop remote media tracks
      if (userStream) {
        console.log('[CONTEXT] Stopping remote media tracks...');
        userStream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      // Reset streams
      setUserStream(null);
      
      // Reset call state
      setCall({});

    } catch (error) {
      console.error('[CONTEXT] Error during call cleanup:', error);
    }
  }, [stream, userStream]);

  /**
   * Set up Socket.IO event listeners
   */
  const initializeSocket = useCallback(() => {
    try {
      // Remove any existing listeners first (prevents duplicates during hot reload)
      socket.removeAllListeners();
      
      console.log('[CONTEXT] Initializing Socket.IO connection...');
      
      // If socket is already connected, get the ID directly and set up listeners
      if (socket.connected && socket.id) {
        console.log('[CONTEXT] Socket already connected, setting up listeners...');
        console.log('[CONTEXT] 📍 Using existing socket ID:', socket.id);
        setMe(socket.id);
        setConnectionStatus('connected');
      } else {
        // Not connected - wait for connection
        setConnectionStatus('connecting');
        // Socket.IO will auto-connect (it's configured to reconnect automatically)
      }

      // Connection events
      socket.on('connect', () => {
        console.log('[CONTEXT] ✅ Connected to signaling server');
        setConnectionStatus('connected');
        
        // If socket ID is available immediately, use it
        // Otherwise wait for 'me' event from server
        if (socket.id) {
          console.log('[CONTEXT] 📍 Got socket ID from connection:', socket.id);
          setMe(socket.id);
        }
      });

      socket.on('disconnect', (reason) => {
        // Only log disconnects that aren't intentional
        if (reason !== 'io client disconnect') {
          console.log('[CONTEXT] ❌ Disconnected from signaling server:', reason);
          setConnectionStatus('disconnected');
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[CONTEXT] Connection error:', error);
        setConnectionStatus('error');
      });

      // Receive our socket ID from the server
      // This ID is used by others to call us
      // Note: Socket.IO also exposes socket.id directly, which we use as a fallback
      socket.on('me', (id) => {
        console.log('[CONTEXT] 📍 Received socket ID from server:', id);
        if (id) {
          setMe(id);
          setConnectionStatus('connected');
        }
      });

      // Use socket.id directly if socket is already connected
      // This handles cases where 'me' event was missed (hot reload, etc.)
      if (socket.connected && socket.id) {
        console.log('[CONTEXT] 📍 Using socket.id directly (already connected):', socket.id);
        setMe(socket.id);
        setConnectionStatus('connected');
      }

      // Receive incoming call (WebRTC offer)
      // This happens when someone calls us
      socket.on('callUser', ({ from, name: callerName, signal }) => {
        console.log('[CONTEXT] 📞 Incoming call from:', callerName, '(', from, ')');
        setCall({ 
          isReceivingCall: true, 
          from, 
          name: callerName, 
          signal 
        });
      });

      // Call was accepted (WebRTC answer received)
      socket.on('callAccepted', (signal) => {
        console.log('[CONTEXT] ✅ Call accepted! Establishing WebRTC connection...');
        setCallAccepted(true);
        
        if (connectionRef.current) {
          // Complete the WebRTC connection by providing the answer signal
          connectionRef.current.signal(signal);
        }
      });

      // Call ended (other user disconnected)
      // Only handle this if we're actually in a call
      socket.on('callEnded', ({ disconnectedUserId } = {}) => {
        // Check if we're in a call by checking multiple conditions using refs
        // This prevents false "call ended" messages when other users disconnect
        // Using refs ensures we get current values, not stale closure values
        const isInCall = callAcceptedRef.current || 
                        callRef.current?.isReceivingCall || 
                        connectionRef.current || 
                        userStreamRef.current !== null;
        
        if (isInCall) {
          console.log('[CONTEXT] 📴 Call ended by other user:', disconnectedUserId);
          handleCallEnd();
        } else {
          // Ignore callEnded events when not in a call
          // This happens when other users connect/disconnect but we're not calling them
          // Silently ignore to avoid console spam
        }
      });

      // Call error
      socket.on('callError', ({ message }) => {
        console.error('[CONTEXT] ❌ Call error:', message);
        alert(`Call error: ${message}`);
        setIsCalling(false);
      });

    } catch (error) {
      console.error('[CONTEXT] Error initializing socket:', error);
      setConnectionStatus('error');
    }
  }, [handleCallEnd]);

  /**
   * Answer an incoming call
   * 
   * This creates a WebRTC peer connection as the "answerer" (non-initiator)
   * 
   * Process:
   * 1. Create Peer instance with initiator: false (we're answering, not initiating)
   * 2. When peer generates answer signal, send it via Socket.IO
   * 3. Provide the incoming offer signal to the peer
   * 4. Wait for WebRTC connection to establish
   * 5. Receive remote stream when connection is ready
   */
  const answerCall = useCallback(() => {
    if (!stream) {
      console.warn('[CONTEXT] Cannot answer call: no local stream available');
      alert('Please enable your camera first!');
      return;
    }

    if (!call.signal) {
      console.error('[CONTEXT] Cannot answer call: no signal data');
      return;
    }

    try {
      console.log('[CONTEXT] 📞 Answering call...');
      setCallAccepted(true);
      setIsCalling(false);

      // Create Peer instance as answerer (non-initiator)
      // initiator: false means we're answering, not initiating the call
      const peer = new Peer({ 
        initiator: false,  // We're answering, not initiating
        trickle: false,     // Send all ICE candidates at once (simpler for learning)
        stream: stream     // Our local media stream
      });

      // When peer generates answer signal, send it to the caller via Socket.IO
      peer.on('signal', (data) => {
        console.log('[CONTEXT] 📤 Sending answer signal...');
        socket.emit('answerCall', { 
          signal: data, 
          to: call.from 
        });
      });

      // When WebRTC connection is established, receive remote stream
      peer.on('stream', (currentStream) => {
        console.log('[CONTEXT] 📹 Received remote stream');
        setUserStream(currentStream);
      });

      // Handle connection events
      peer.on('connect', () => {
        console.log('[CONTEXT] ✅ WebRTC connection established!');
      });

      peer.on('error', (error) => {
        console.error('[CONTEXT] ❌ Peer connection error:', error);
        alert('Connection error occurred. Please try again.');
        handleCallEnd();
      });

      // Provide the offer signal to complete the connection
      peer.signal(call.signal);

      // Store peer reference for cleanup
      connectionRef.current = peer;

    } catch (error) {
      console.error('[CONTEXT] Error answering call:', error);
      alert('Failed to answer call. Please try again.');
      handleCallEnd();
    }
  }, [stream, call, handleCallEnd]);

  /**
   * Initiate a call to another user
   * 
   * This creates a WebRTC peer connection as the "caller" (initiator)
   * 
   * Process:
   * 1. Create Peer instance with initiator: true (we're initiating the call)
   * 2. When peer generates offer signal, send it via Socket.IO
   * 3. Wait for answer signal from the other user
   * 4. Provide answer signal to peer to complete connection
   * 5. Receive remote stream when connection is ready
   * 
   * @param {string} id - Socket ID of the user to call
   */
  const callUser = useCallback((id) => {
    if (!id || id.trim() === '') {
      console.warn('[CONTEXT] Cannot call: invalid user ID');
      return;
    }

    if (!stream) {
      console.warn('[CONTEXT] Cannot call: no local stream available');
      alert('Please enable your camera first!');
      return;
    }

    if (id === me) {
      alert('You cannot call yourself!');
      return;
    }

    try {
      console.log('[CONTEXT] 📞 Calling user:', id);
      setIsCalling(true);
      setCallEnded(false);

      // Create Peer instance as initiator (caller)
      // initiator: true means we're starting the call
      const peer = new Peer({ 
        initiator: true,   // We're initiating the call
        trickle: false,    // Send all ICE candidates at once
        stream: stream    // Our local media stream
      });

      // When peer generates offer signal, send it to the target user via Socket.IO
      peer.on('signal', (data) => {
        console.log('[CONTEXT] 📤 Sending offer signal to', id);
        socket.emit('callUser', { 
          userToCall: id, 
          signalData: data, 
          from: me, 
          name: name || 'Anonymous' 
        });
      });

      // When WebRTC connection is established, receive remote stream
      peer.on('stream', (currentStream) => {
        console.log('[CONTEXT] 📹 Received remote stream');
        setUserStream(currentStream);
      });

      // Handle connection events
      peer.on('connect', () => {
        console.log('[CONTEXT] ✅ WebRTC connection established!');
        setIsCalling(false);
      });

      peer.on('error', (error) => {
        console.error('[CONTEXT] ❌ Peer connection error:', error);
        alert('Connection error occurred. Please try again.');
        setIsCalling(false);
        handleCallEnd();
      });

      // Store peer reference for cleanup
      connectionRef.current = peer;

    } catch (error) {
      console.error('[CONTEXT] Error calling user:', error);
      alert('Failed to initiate call. Please try again.');
      setIsCalling(false);
    }
  }, [stream, me, name, handleCallEnd]);

  /**
   * End the current call and clean up resources
   */
  const leaveCall = useCallback(() => {
    console.log('[CONTEXT] 📴 Ending call...');
    handleCallEnd();
  }, [handleCallEnd]);

  /**
   * Cleanup function for component unmount
   * Only called on actual page unload, not during hot reload
   */
  const cleanup = useCallback(() => {
    console.log('[CONTEXT] Cleaning up...');
    handleCallEnd();
    
    // Remove all listeners
    socket.removeAllListeners();
    
    // Only disconnect socket on actual page unload (not during hot reload)
    // During hot reload, socket stays connected to avoid disconnect/reconnect cycle
    if (socket.connected) {
      // Check if this is a hot reload (module.hot is available in webpack dev mode)
      const isHotReload = typeof module !== 'undefined' && module.hot;
      if (!isHotReload) {
        console.log('[CONTEXT] Disconnecting socket (page unload)');
        socket.disconnect();
      } else {
        console.log('[CONTEXT] Skipping socket disconnect (hot reload)');
      }
    }
    
    socketInitializedRef.current = false;
  }, [handleCallEnd]);

  return (
    <SocketContext.Provider value={{
      // Call state
      call,
      callAccepted,
      setCallAccepted,
      callEnded,
      isCalling,
      
      // Media streams
      stream,
      setStream,
      userStream,
      
      // User info
      name,
      setName,
      me,
      
      // Connection status
      connectionStatus,
      
      // Functions
      callUser,
      leaveCall,
      answerCall,
      
      // Legacy refs (for backward compatibility)
      myVideo,
      userVideo,
      setLoadMyCamera,
      loadMyCamera
    }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export { ContextProvider, SocketContext };
