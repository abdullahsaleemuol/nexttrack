import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
  preview_url: string | null;
}

// The massive central brain that keeps track of what the user is listening to,
// their history, and what's coming up next in the endless queue.
interface PlayerState {
  selectedGenre: string | null;
  candidatePool: Track[];
  currentTrack: Track | null;
  nextTrackId: string | null;
  trackHistory: Track[];
  futureQueue: Track[];
  playedTrackIds: string[];
  setSelectedGenre: (genre: string | null) => void;
  setCandidatePool: (tracks: Track[]) => void;
  setCurrentTrack: (track: Track | null) => void;
  setNextTrackId: (id: string | null) => void;
  pushToHistory: (track: Track) => void;
  popFromHistory: () => Track | undefined;
  pushToFuture: (track: Track) => void;
  popFromFuture: () => Track | undefined;
  clearFuture: () => void;
  addPlayedTrack: (id: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      selectedGenre: null,
      candidatePool: [],
      currentTrack: null,
      nextTrackId: null,
      trackHistory: [],
      futureQueue: [],
      playedTrackIds: [],
      setSelectedGenre: (genre) => set({ selectedGenre: genre }),
      setCandidatePool: (tracks) => set({ candidatePool: tracks }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
      setNextTrackId: (id) => set({ nextTrackId: id }),
      // Keep a running log of everything we've played so the user can easily skip back
      pushToHistory: (track) => set((state) => ({ trackHistory: [...state.trackHistory, track] })),
      popFromHistory: () => {
        const state = get();
        if (state.trackHistory.length === 0) return undefined;
        const newHistory = [...state.trackHistory];
        const prevTrack = newHistory.pop();
        set({ trackHistory: newHistory });
        return prevTrack;
      },
      // If the user skips back, we need to stash the tracks they skipped so we can replay them if they skip forward again
      pushToFuture: (track) => set((state) => ({ futureQueue: [track, ...state.futureQueue] })),
      popFromFuture: () => {
        const state = get();
        if (state.futureQueue.length === 0) return undefined;
        const newFuture = [...state.futureQueue];
        const nextTrack = newFuture.shift();
        set({ futureQueue: newFuture });
        return nextTrack;
      },
      clearFuture: () => set({ futureQueue: [] }),
      addPlayedTrack: (id) => set((state) => {
        if (!state.playedTrackIds.includes(id)) {
          return { playedTrackIds: [...state.playedTrackIds, id] };
        }
        return state;
      }),
    }),
    {
      name: 'nexttrack-storage',
    }
  )
);
