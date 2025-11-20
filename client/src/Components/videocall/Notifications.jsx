/**
 * Notifications Component
 * 
 * Displays incoming call notifications as a modal dialog.
 * 
 * EDUCATIONAL NOTES:
 * - This component listens for incoming call events from the signaling server
 * - When someone calls you, the 'callUser' event is received in Context.js
 * - This sets call.isReceivingCall to true, which triggers this modal
 * - User can accept (answerCall) or decline (leaveCall) the call
 * 
 * FLOW:
 * 1. Incoming call → call.isReceivingCall = true
 * 2. Modal opens automatically
 * 3. User clicks Accept → answerCall() creates Peer connection
 * 4. User clicks Decline → leaveCall() rejects the call
 */

import React, { useContext, useEffect, useState } from 'react';
import { Box, Button, Grid, Modal, Typography } from "@mui/material";
import { SocketContext } from '../../context/Context';
import { Call, CallEnd } from '@mui/icons-material';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  pt: 3,
  px: 4,
  pb: 3,
  borderRadius: 2,
};

const Notifications = () => {
  const { answerCall, call, callAccepted, leaveCall } = useContext(SocketContext);
  const [open, setOpen] = useState(false);

  /**
   * Open modal when receiving a call
   * This effect runs whenever:
   * - call.isReceivingCall changes (incoming call)
   * - callAccepted changes (call was answered)
   */
  useEffect(() => {
    if (call.isReceivingCall && !callAccepted) {
      console.log('[NOTIFICATIONS] 📞 Incoming call from:', call.name);
      setOpen(true);
    } else if (callAccepted) {
      // Close modal if call was accepted
      setOpen(false);
    }
  }, [call, callAccepted]);

  /**
   * Handle accepting the call
   * This will:
   * 1. Create a Peer instance (as answerer)
   * 2. Generate WebRTC answer signal
   * 3. Send answer back to caller via Socket.IO
   * 4. Establish WebRTC connection
   */
  const handleAccept = () => {
    console.log('[NOTIFICATIONS] ✅ Accepting call from:', call.name);
    try {
      answerCall();
      setOpen(false);
    } catch (error) {
      console.error('[NOTIFICATIONS] Error accepting call:', error);
      alert('Failed to accept call. Please try again.');
    }
  };

  /**
   * Handle declining the call
   * This will:
   * 1. Close the modal
   * 2. Reset call state
   * 3. Notify the caller (if needed)
   */
  const handleDecline = () => {
    console.log('[NOTIFICATIONS] ❌ Declining call from:', call.name);
    setOpen(false);
    leaveCall();
  };

  /**
   * Handle closing modal without action
   * (User clicked outside or pressed ESC)
   */
  const handleClose = () => {
    console.log('[NOTIFICATIONS] Modal closed');
    setOpen(false);
    // Optionally decline the call when modal is closed
    // leaveCall();
  };

  return (
    <Modal 
      open={open} 
      onClose={handleClose}
      aria-labelledby="incoming-call-modal"
      aria-describedby="incoming-call-description"
    >
      <Box sx={modalStyle}>
        <Grid container spacing={2} sx={{ alignItems: "center", justifyContent: "center" }}>
          <Grid item xs={12} sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h5" component="h2" id="incoming-call-modal">
              Incoming Call
            </Typography>
          </Grid>
          
          <Grid item xs={12} sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h6" color="primary">
              {call.name || 'Unknown User'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              wants to video chat with you
            </Typography>
          </Grid>
          
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
            <Button 
              variant="contained" 
              color="success" 
              size="large"
              startIcon={<Call />}
              onClick={handleAccept}
              sx={{ minWidth: 120 }}
            >
              Accept
            </Button>
            
            <Button 
              variant="contained" 
              color="error" 
              size="large"
              startIcon={<CallEnd />}
              onClick={handleDecline}
              sx={{ minWidth: 120 }}
            >
              Decline
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
};

export default Notifications;
