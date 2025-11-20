/**
 * VideoPlayer Component
 * 
 * Displays local and remote video streams with controls.
 * 
 * EDUCATIONAL NOTES:
 * - Local video: Your own camera feed (from getUserMedia)
 * - Remote video: Other person's camera feed (from WebRTC peer connection)
 * - Video elements use refs to attach MediaStream objects
 * - Streams are attached via srcObject property (not src)
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Grid, Typography, Paper, Box, Button, Switch, Chip, CircularProgress } from '@mui/material';
import { VideocamOff as VideoOffIcon, Videocam as VideoOnIcon } from '@mui/icons-material/';
import VideocamOffOutlinedIcon from '@mui/icons-material/VideocamOffOutlined';
import { styled } from '@mui/system';
import { SocketContext } from '../../context/Context';


const VideoSwitch = styled(Switch)(({ theme }) => ({
  width: 50, // Adjust the width
  height: 28, // Adjust the height
  padding: 6, // Adjust the padding
  '& .MuiSwitch-switchBase': {
    margin: 1,
    padding: 0,
    transform: 'translateX(5px)', // Adjust the transform
    '&.Mui-checked': {
      color: '#fff',
      transform: 'translateX(20px)', // Adjust the transform
      '& .MuiSwitch-thumb:before': {
        content: "''",
        position: 'absolute',
        width: '100%',
        height: '100%',
        left: 0,
        top: 0,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff',
        )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`,
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: theme.palette.mode === 'dark' ? '#003892' : '#001e3c',
    width: 22, // Adjust the width
    height: 22, // Adjust the height
    '&:before': {
      display: 'none',
    },
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: theme.palette.mode === 'dark' ? '#8796A5' : '#aab4be',
    borderRadius: 14, // Adjust the borderRadius
  },
}));

const StyledGridContainer = styled(Grid)(({ theme }) => ({
  justifyContent: 'center',
  [theme.breakpoints.down('xs')]: {
    flexDirection: 'column',
  },
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: '10px',
  border: '2px solid black',
  margin: '10px',
}));

const VideoPlayer = () => {
  const { 
    name, 
    callAccepted, 
    callEnded, 
    stream, 
    setStream, 
    userStream, 
    connectionStatus,
    isCalling,
    call
  } = useContext(SocketContext);
  
  // Refs for video elements
  const myV = useRef(null);
  const uV = useRef(null);
  
  const [videoOn, setVideoOn] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Attach media streams to video elements
   * This runs whenever stream or userStream changes
   */
  useEffect(() => {
    try {
      // Attach local stream to video element
      if (stream && myV.current) {
        console.log('[VIDEOPLAYER] Attaching local stream to video element');
        myV.current.srcObject = stream;
        setVideoOn(true);
      } else if (!stream && myV.current) {
        // Clear video element when stream is removed
        myV.current.srcObject = null;
      }

      // Attach remote stream to video element
      if (userStream && uV.current) {
        console.log('[VIDEOPLAYER] Attaching remote stream to video element');
        uV.current.srcObject = userStream;
      } else if (!userStream && uV.current) {
        // Clear video element when stream is removed
        uV.current.srcObject = null;
      }
    } catch (error) {
      console.error('[VIDEOPLAYER] Error attaching stream:', error);
      setError('Failed to display video stream');
    }
  }, [stream, userStream]);

  /**
   * Request access to user's camera and microphone
   * This uses the browser's getUserMedia API
   */
  const openVideo = useCallback(async () => {
    try {
      setIsLoadingStream(true);
      setError(null);
      
      console.log('[VIDEOPLAYER] Requesting camera and microphone access...');
      
      // Request media stream from browser
      // This will prompt the user for permission
      const currentStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,  // Request video track
        audio: true   // Request audio track
      });
      
      console.log('[VIDEOPLAYER] ✅ Media stream obtained:', {
        videoTracks: currentStream.getVideoTracks().length,
        audioTracks: currentStream.getAudioTracks().length
      });
      
      setStream(currentStream);
      setVideoOn(true);
    } catch (error) {
      console.error('[VIDEOPLAYER] ❌ Error accessing media devices:', error);
      
      let errorMessage = 'Failed to access camera/microphone. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera and microphone access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera/microphone found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera/microphone is being used by another application.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      setVideoOn(false);
    } finally {
      setIsLoadingStream(false);
    }
  }, [setStream]);

  /**
   * Stop all media tracks and release camera/microphone
   */
  const closeVideo = useCallback(() => {
    try {
      if (stream) {
        console.log('[VIDEOPLAYER] Stopping media tracks...');
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('[VIDEOPLAYER] Stopped track:', track.kind, track.label);
        });
      }
      setStream(null);
      setVideoOn(false);
      setError(null);
    } catch (error) {
      console.error('[VIDEOPLAYER] Error closing video:', error);
    }
  }, [stream, setStream]);

  /**
   * Handle video toggle switch
   */
  const handleVideoChange = (event) => {
    event.preventDefault();
    try {
      if (event.target.checked) {
        openVideo();
      } else {
        closeVideo();
      }
    } catch (error) {
      console.error('[VIDEOPLAYER] Error toggling video:', error);
      setError('Failed to toggle video');
    }
  };

  /**
   * Get connection status color
   */
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  /**
   * Get connection status text
   */
  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };


  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {/* Connection Status Indicator */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip 
          label={getStatusText()} 
          color={getStatusColor()} 
          size="small"
        />
        {isCalling && (
          <Chip 
            label="Calling..." 
            color="info" 
            size="small"
            icon={<CircularProgress size={16} />}
          />
        )}
        {callAccepted && !callEnded && (
          <Chip 
            label="In Call" 
            color="success" 
            size="small"
          />
        )}
      </Box>

      {/* Error Message */}
      {error && (
        <Box sx={{ mb: 2, p: 1, bgcolor: 'error.light', borderRadius: 1 }}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      )}

      <StyledGridContainer container spacing={2}>
        {/* Local Video (Your Camera) */}
        <Grid item xs={12} md={6}>
          <StyledPaper>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography color="primary" variant="h6">
                {name || 'You'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Local Video
              </Typography>
            </Box>
            
            <Box 
              sx={{ 
                width: "100%", 
                height: "250px", 
                overflow: "hidden",
                borderRadius: 1,
                bgcolor: 'grey.900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {isLoadingStream ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    Accessing camera...
                  </Typography>
                </Box>
              ) : stream ? (
                <video 
                  playsInline 
                  muted 
                  ref={myV} 
                  autoPlay 
                  style={{ 
                    objectFit: 'cover', 
                    width: '100%', 
                    height: '100%' 
                  }} 
                />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <VideocamOffOutlinedIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Camera Off
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <VideoSwitch 
                checked={videoOn} 
                onChange={handleVideoChange} 
                disabled={isLoadingStream}
                icon={<VideoOffIcon style={{ color: "black" }} />} 
                checkedIcon={<VideoOnIcon color='primary' />} 
              />
              <Typography variant="body2">
                {videoOn ? 'Camera On' : 'Camera Off'}
              </Typography>
            </Box>
          </StyledPaper>
        </Grid>

        {/* Remote Video (Other Person's Camera) */}
        {callAccepted && !callEnded && (
          <Grid item xs={12} md={6}>
            <StyledPaper>
              <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" color="success.main">
                  {call?.name || 'Remote User'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Remote Video
                </Typography>
              </Box>
              
              <Box 
                sx={{ 
                  width: "100%", 
                  height: "250px", 
                  overflow: "hidden",
                  borderRadius: 1,
                  bgcolor: 'grey.900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {userStream ? (
                  <video 
                    playsInline 
                    ref={uV} 
                    autoPlay 
                    style={{ 
                      objectFit: 'cover', 
                      width: '100%', 
                      height: '100%' 
                    }} 
                  />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary">
                      Waiting for video...
                    </Typography>
                  </Box>
                )}
              </Box>
            </StyledPaper>
          </Grid>
        )}
      </StyledGridContainer>
    </Box>
  );
};

export default VideoPlayer;
