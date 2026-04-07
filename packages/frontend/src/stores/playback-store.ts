import { create } from "zustand";

interface PlaybackState {
  playing: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
}

interface PlaybackActions {
  play: (audioEl: HTMLAudioElement | null, videoEl?: HTMLVideoElement | null) => void;
  pause: () => void;
  seek: (ms: number) => void;
  setRate: (rate: number) => void;
  setDuration: (ms: number) => void;
  reset: () => void;
}

// Module-level variables — no React state, no useEffect
let _rafId: number | null = null;
let _audioEl: HTMLAudioElement | null = null;
let _videoEl: HTMLVideoElement | null = null;
let _lastWallTime: number = 0;

function startLoop() {
  stopLoop();
  const tick = () => {
    const state = usePlaybackStore.getState();
    if (!state.playing) return;

    let newTimeMs: number;
    if (_audioEl && !_audioEl.paused) {
      // Sync from audio element (source of truth)
      newTimeMs = _audioEl.currentTime * 1000;
    } else {
      // Wall-clock fallback when no audio
      const now = performance.now();
      const elapsed = (now - _lastWallTime) * state.playbackRate;
      _lastWallTime = now;
      newTimeMs = state.currentTimeMs + elapsed;
    }

    // Clamp and check for end
    if (newTimeMs >= state.durationMs && state.durationMs > 0) {
      newTimeMs = state.durationMs;
      usePlaybackStore.getState().pause();
      usePlaybackStore.setState({ currentTimeMs: newTimeMs });
      return;
    }

    usePlaybackStore.setState({ currentTimeMs: newTimeMs });

    // Sync video if drifted more than 100ms from audio
    if (_audioEl && _videoEl && !_audioEl.paused) {
      const drift = Math.abs(_videoEl.currentTime - _audioEl.currentTime);
      if (drift > 0.1) {
        _videoEl.currentTime = _audioEl.currentTime;
      }
    }

    _rafId = requestAnimationFrame(tick);
  };
  _rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
}

const initialState: PlaybackState = {
  playing: false,
  currentTimeMs: 0,
  durationMs: 0,
  playbackRate: 1,
};

export const usePlaybackStore = create<PlaybackState & PlaybackActions>((set, get) => ({
  ...initialState,

  play(audioEl, videoEl) {
    _audioEl = audioEl;
    _videoEl = videoEl ?? null;

    const { playbackRate } = get();

    if (audioEl) {
      audioEl.playbackRate = playbackRate;
      audioEl.play().catch(() => {});
    }

    if (_videoEl) {
      _videoEl.playbackRate = playbackRate;
      _videoEl.play().catch(() => {});
    }

    set({ playing: true });
    _lastWallTime = performance.now();
    startLoop();
  },

  pause() {
    if (_audioEl) _audioEl.pause();
    if (_videoEl) _videoEl.pause();
    set({ playing: false });
    stopLoop();
  },

  seek(ms) {
    const { durationMs } = get();
    const clamped = Math.min(Math.max(ms, 0), durationMs);
    set({ currentTimeMs: clamped });
    if (_audioEl) _audioEl.currentTime = clamped / 1000;
    if (_videoEl) _videoEl.currentTime = clamped / 1000;
  },

  setRate(rate) {
    set({ playbackRate: rate });
    if (_audioEl) _audioEl.playbackRate = rate;
    if (_videoEl) _videoEl.playbackRate = rate;
  },

  setDuration(ms) {
    set({ durationMs: ms });
  },

  reset() {
    get().pause();
    set({ currentTimeMs: 0, durationMs: 0, playbackRate: 1 });
    _audioEl = null;
    _videoEl = null;
  },
}));
