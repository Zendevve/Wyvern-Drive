import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Slider,
  Typography,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBackward,
  faForward,
  faPause,
  faPlay,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useMediaPlayer } from './MediaPlayerProvider';

function formatTime(secs) {
  if (isNaN(secs) || secs === 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * system24 TUI Floating Audio Daemon Dock
 */
export default function MediaDock() {
  const { currentTrack, isPlaying, togglePlay, stop, audioUrl } =
    useMediaPlayer();
  const audioRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [audioUrl, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e, val) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolume = (e, val) => {
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (muted && val > 0) setMuted(false);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const skip = (secs) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(duration, audioRef.current.currentTime + secs)
      );
    }
  };

  if (!currentTrack) return null;

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 360,
        zIndex: 1400,
        bgcolor: 'surfaceElevated',
        borderColor: 'primary.main',
        borderRadius: 0,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={stop}
      />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 }}>
        <Typography variant="overline" sx={{ color: 'primary.main', fontSize: 9.5, letterSpacing: '0.08ch' }}>
          [ AUDIO_DAEMON // PLAYING ]
        </Typography>
        <IconButton
          size="small"
          onClick={stop}
          sx={{ color: 'text.disabled', p: 0.25 }}
        >
          <FontAwesomeIcon icon={faXmark} size="xs" />
        </IconButton>
      </Box>

      {/* Track Title */}
      <Typography
        variant="body2"
        noWrap
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          fontSize: 12,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        &gt; {currentTrack.name}
      </Typography>

      {/* Scrubber */}
      <Box sx={{ px: 0.5 }}>
        <Slider
          size="small"
          value={currentTime}
          max={duration || 100}
          onChange={handleSeek}
          sx={{
            py: 0.5,
            color: 'primary.main',
            '& .MuiSlider-thumb': {
              width: 10,
              height: 10,
              borderRadius: 0,
            },
            '& .MuiSlider-rail': {
              borderRadius: 0,
              bgcolor: 'bg1',
            },
            '& .MuiSlider-track': {
              borderRadius: 0,
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
            {formatTime(duration)}
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={() => skip(-15)} title="Back 15s">
            <FontAwesomeIcon icon={faBackward} size="xs" />
          </IconButton>
          <IconButton
            size="small"
            onClick={togglePlay}
            sx={{
              bgcolor: 'surface2',
              color: 'primary.main',
              border: '1px solid',
              borderColor: 'primary.main',
              p: 0.75,
            }}
          >
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size="xs" />
          </IconButton>
          <IconButton size="small" onClick={() => skip(15)} title="Forward 15s">
            <FontAwesomeIcon icon={faForward} size="xs" />
          </IconButton>
        </Box>

        {/* Volume */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 110 }}>
          <IconButton size="small" onClick={toggleMute} sx={{ color: 'text.disabled', p: 0.25 }}>
            <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} size="xs" />
          </IconButton>
          <Slider
            size="small"
            value={muted ? 0 : volume}
            max={1}
            step={0.05}
            onChange={handleVolume}
            sx={{
              color: 'text.secondary',
              '& .MuiSlider-thumb': { width: 8, height: 8, borderRadius: 0 },
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
}
