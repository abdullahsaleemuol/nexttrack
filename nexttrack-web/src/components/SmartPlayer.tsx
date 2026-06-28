"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { fetchRecommendation } from "@/lib/api";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// Quick helper to format seconds into mm:ss for the UI
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function SmartPlayer() {
  const {
    currentTrack,
    setCurrentTrack,
    candidatePool,
    nextTrackId,
    setNextTrackId,
    trackHistory,
    pushToHistory,
    popFromHistory,
    futureQueue,
    pushToFuture,
    popFromFuture,
    addPlayedTrack,
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([1]);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  // Grab the actual track object for what's coming up next
  const nextTrack = candidatePool.find((t) => t.id === nextTrackId);

  const handleSkip = () => {
    if (!candidatePool.length) return;

    if (currentTrack) {
      pushToHistory(currentTrack);
    }

    const nextFromFuture = popFromFuture();
    if (nextFromFuture) {
      setCurrentTrack(nextFromFuture);
      return;
    }

    if (nextTrack) {
      setCurrentTrack(nextTrack);
      return;
    }

    // Safety net: if we somehow lost the next track ID, just pick something random from the pool
    const randomTrack =
      candidatePool[Math.floor(Math.random() * candidatePool.length)];
    setCurrentTrack(randomTrack);
  };

  const handleSkipBack = () => {
    if (currentTrack) {
      pushToFuture(currentTrack);
    }
    const prev = popFromHistory();
    if (prev) {
      setCurrentTrack(prev);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration || 30; // Previews are typically 30s
      setCurrentTime(current);
      if (duration > 0) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const handleSeek = (val: number | readonly number[]) => {
    if (audioRef.current) {
      const newProgress = Array.isArray(val) ? val[0] : (val as number);
      const duration = audioRef.current.duration || 30;
      const newTime = (newProgress / 100) * duration;
      audioRef.current.currentTime = newTime;
      setProgress(newProgress);
      setCurrentTime(newTime);
    }
  };

  // Fire off a background request to figure out what plays next as soon as the current track starts
  useEffect(() => {
    if (!currentTrack) return;

    // Some tracks don't have previews available, so we just skip them immediately to avoid dead air
    if (!currentTrack.preview_url) {
      console.log("Track has no preview, skipping...", currentTrack.name);
      handleSkip();
      return;
    }

    async function getNextRec() {
      // Add current track to played track IDs immediately
      addPlayedTrack(currentTrack!.id);

      // If the user is just skipping back and forth through history, we don't need to hit the API again.
      // We can just pull the next track straight from our future queue.
      if (futureQueue.length > 0) {
        setNextTrackId(futureQueue[0].id);
        return;
      }

      const latestPlayedIds = usePlayerStore.getState().playedTrackIds;

      setIsFetchingNext(true);
      try {
        const candidateIds = candidatePool
          .map((t) => t.id)
          .filter(
            (id) => id !== currentTrack?.id && !latestPlayedIds.includes(id),
          );

        if (candidateIds.length === 0) {
          setIsFetchingNext(false);
          return;
        }

        const data = await fetchRecommendation(
          currentTrack!.id,
          candidateIds,
          latestPlayedIds,
        );
        setNextTrackId(data.next_track_id);
      } catch (error) {
        console.error("Failed to fetch recommendation:", error);
      } finally {
        setIsFetchingNext(false);
      }
    }

    getNextRec();
  }, [currentTrack?.id]); // Only run when the track ID changes

  // Keep the native HTML5 audio element's volume in sync with our React state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0];
    }
  }, [volume]);

  // Ensure our play/pause state matches what the audio element is actually doing
  useEffect(() => {
    if (audioRef.current && currentTrack?.preview_url) {
      if (isPlaying) {
        audioRef.current.play().catch((e) => {
          console.error("Playback failed", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack?.id]);

  const [prevTrackId, setPrevTrackId] = useState(currentTrack?.id);

  // Whenever the track changes, reset the progress bar and auto-play immediately
  if (currentTrack?.id !== prevTrackId) {
    setPrevTrackId(currentTrack?.id);
    if (currentTrack?.preview_url) {
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);
    }
  }

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 p-4 z-50 animate-in slide-in-from-bottom-full duration-500 shadow-2xl">
      {/* The actual hidden audio element doing the heavy lifting */}
      {currentTrack.preview_url && (
        <audio
          ref={audioRef}
          src={currentTrack.preview_url}
          onEnded={handleSkip}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity duration-300 z-10">
        <Slider
          value={[progress]}
          max={100}
          step={0.1}
          onValueChange={handleSeek}
          className="w-full cursor-pointer"
        />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-muted pointer-events-none transition-all">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Track Info (Left) */}
        <div className="flex items-center gap-4 w-1/4 md:w-1/3 min-w-0">
          <div className="relative h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted shadow-md group">
            {currentTrack.album?.images?.[0]?.url && (
              <img
                src={currentTrack.album.images[0].url}
                alt={currentTrack.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            )}
          </div>
          <div className="min-w-0 flex-grow">
            <h4 className="font-bold text-base truncate flex items-center gap-2">
              {currentTrack.name}
            </h4>
            <p className="text-sm text-muted-foreground truncate">
              {currentTrack.artists.map((a) => a.name).join(", ")}
            </p>
          </div>
        </div>

        {/* Controls (Center) */}
        <div className="flex flex-col items-center justify-center gap-1 w-2/4 md:w-1/3">
          <div className="flex items-center gap-4 md:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full h-10 w-10 transition-colors"
              onClick={handleSkipBack}
              disabled={trackHistory.length === 0}
            >
              <SkipBack className="h-5 w-5" fill="currentColor" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all shadow-lg"
              onClick={togglePlay}
              disabled={!currentTrack.preview_url}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5" fill="currentColor" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full h-10 w-10 transition-colors"
              onClick={handleSkip}
            >
              <SkipForward className="h-5 w-5" fill="currentColor" />
            </Button>
          </div>

          <div className="text-[11px] font-medium text-muted-foreground tabular-nums opacity-70 tracking-wide mt-1 hidden md:block">
            {formatTime(currentTime)} / 0:30
          </div>
        </div>

        {/* Up Next & Volume (Right) */}
        <div className="flex items-center justify-end gap-6 w-1/4 md:w-1/3">
          {/* Up Next Indicator */}
          <div className="hidden md:flex items-center justify-end gap-3 min-w-0 max-w-[200px] text-right">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                Up Next
              </p>
              {isFetchingNext ? (
                <div className="flex items-center justify-end gap-2 text-xs text-primary animate-pulse">
                  Analyzing vectors...
                </div>
              ) : nextTrack ? (
                <p
                  className="text-xs font-medium truncate w-full"
                  title={nextTrack.name}
                >
                  {nextTrack.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">End of queue</p>
              )}
            </div>
            {isFetchingNext ? (
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse flex-shrink-0" />
            ) : nextTrack?.album?.images?.[0]?.url ? (
              <img
                src={nextTrack.album.images[0].url}
                alt="Up next"
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0 opacity-70"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 opacity-70">
                <Music className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-3">
            {volume[0] === 0 ? (
              <VolumeX
                className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setVolume([1])}
              />
            ) : (
              <Volume2
                className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setVolume([0])}
              />
            )}
            <div className="w-24">
              <Slider
                value={volume}
                onValueChange={(val) =>
                  setVolume(
                    Array.isArray(val) ? (val as number[]) : [val as number],
                  )
                }
                max={1}
                step={0.01}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
