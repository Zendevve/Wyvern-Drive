import React from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faMusic,
  faPause,
  faPlay,
  faRotateLeft,
  faRotateRight,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useMediaPlayer } from './MediaPlayerProvider';

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * First-Party Floating Dockable Audio & Media Player (Apple Music / Linear grade).
 */
export default function MediaDock() {
  const {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    isMuted,
    isMinimized,
    setIsMinimized,
    setVolume,
    setIsMuted,
    togglePlay,
    seek,
    skip,
    closePlayer,
  } = useMediaPlayer();

  if (!currentTrack) return null;

  return (
    <Box
      data-testid="media-dock"
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        left: { xs: 16, sm: 'auto' },
        width: { xs: 'auto', sm: isMinimized ? 300 : 400 },
        zIndex: 1400,
        bgcolor: 'surfaceElevated',
        border: '1px solid hairline',
        borderRadius: '12px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
        backdropFilter: 'blur(20px)',
        p: 1.75,
        transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            bgcolor: 'rgba(0, 132, 255, 0.12)',
            border: '1px solid rgba(0, 132, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'accentBlue',
            flexShrink: 0,
          }}
        >
          <FontAwesomeIcon icon={faMusic} size="sm" />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: 600, color: 'ink', fontSize: 13, lineHeight: 1.2 }}
          >
            {currentTrack.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'inkMuted', fontSize: 11, fontFamily: 'monospace' }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={isMinimized ? 'Expand player' : 'Minimize player'}
          onClick={() => setIsMinimized(!isMinimized)}
          sx={{ color: 'inkMuted', p: 0.5 }}
        >
          <FontAwesomeIcon icon={isMinimized ? faChevronUp : faChevronDown} size="xs" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Close player"
          onClick={closePlayer}
          sx={{ color: 'inkMuted', '&:hover': { color: 'error.main' }, p: 0.5 }}
        >
          <FontAwesomeIcon icon={faXmark} size="xs" />
        </IconButton>
      </Box>

      {!isMinimized && (
        <Box sx={{ mt: 1.25 }}>
          {/* Scrubber slider */}
          <Box sx={{ px: 0.5 }}>
            <Slider
              size="small"
              value={currentTime}
              max={duration || 100}
              onChange={(_, val) => seek(val)}
              aria-label="Audio scrubber"
              sx={{
                color: 'accentBlue',
                height: 3,
                py: 0.75,
                '& .MuiSlider-thumb': {
                  width: 10,
                  height: 10,
                  transition: '0.2s cubic-bezier(.47,1.64,.41,.8)',
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: '0 0 0 5px rgba(0, 132, 255, 0.2)',
                  },
                },
                '& .MuiSlider-rail': {
                  bgcolor: 'rgba(255,255,255,0.10)',
                },
              }}
            />
          </Box>

          {/* Controls row */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mt: 0.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton
                size="small"
                aria-label="Skip backward 15 seconds"
                title="Skip back 15s"
                onClick={() => skip(-15)}
                sx={{ color: 'inkSecondary', width: 28, height: 28 }}
              >
                <FontAwesomeIcon icon={faRotateLeft} size="xs" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={togglePlay}
                sx={{
                  bgcolor: 'ink',
                  color: '#0A0B0D',
                  width: 32,
                  height: 32,
                  '&:hover': { bgcolor: '#FFFFFF', transform: 'scale(1.04)' },
                }}
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size="xs" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Skip forward 15 seconds"
                title="Skip forward 15s"
                onClick={() => skip(15)}
                sx={{ color: 'inkSecondary', width: 28, height: 28 }}
              >
                <FontAwesomeIcon icon={faRotateRight} size="xs" />
              </IconButton>
            </Box>

            {/* Volume control */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: 100 }}>
              <IconButton
                size="small"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                onClick={() => setIsMuted(!isMuted)}
                sx={{ color: 'inkMuted', p: 0.5 }}
              >
                <FontAwesomeIcon icon={isMuted ? faVolumeXmark : faVolumeHigh} size="xs" />
              </IconButton>
              <Slider
                size="small"
                value={isMuted ? 0 : volume * 100}
                onChange={(_, val) => {
                  setVolume(val / 100);
                  if (isMuted) setIsMuted(false);
                }}
                aria-label="Volume"
                sx={{
                  color: 'inkSecondary',
                  height: 3,
                  '& .MuiSlider-thumb': { width: 8, height: 8 },
                  '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.10)' },
                }}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
