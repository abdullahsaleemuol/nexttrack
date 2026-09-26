import { usePlayerStore, Track } from '@/store/usePlayerStore';

// Test fixtures
const createMockTrack = (id: string, name: string): Track => ({
  id,
  name,
  artists: [{ name: `Artist for ${name}` }],
  album: { images: [{ url: `https://img.example.com/${id}.jpg` }] },
  preview_url: `https://preview.example.com/${id}.mp3`,
});

const trackA = createMockTrack('track-a', 'Alpha Wave');
const trackB = createMockTrack('track-b', 'Beta Groove');
const trackC = createMockTrack('track-c', 'Gamma Rhythm');
const trackD = createMockTrack('track-d', 'Delta Beat');

beforeEach(() => {
  usePlayerStore.setState({
    selectedGenre: null,
    candidatePool: [],
    currentTrack: null,
    nextTrackId: null,
    trackHistory: [],
    futureQueue: [],
    playedTrackIds: [],
  });
});

describe('usePlayerStore', () => {
  describe('Forward skip handling', () => {
    test('pushes the outgoing track to history and updates currentTrack', () => {
      const { pushToHistory, setCurrentTrack } = usePlayerStore.getState();

      setCurrentTrack(trackA);
      pushToHistory(trackA);
      setCurrentTrack(trackB);

      const state = usePlayerStore.getState();
      expect(state.trackHistory).toHaveLength(1);
      expect(state.trackHistory[0].id).toBe('track-a');
      expect(state.currentTrack?.id).toBe('track-b');
    });

    test('maintains chronological order across multiple skips', () => {
      const { pushToHistory, setCurrentTrack } = usePlayerStore.getState();

      setCurrentTrack(trackA);

      pushToHistory(trackA);
      setCurrentTrack(trackB);

      pushToHistory(trackB);
      setCurrentTrack(trackC);

      pushToHistory(trackC);
      setCurrentTrack(trackD);

      const { trackHistory, currentTrack } = usePlayerStore.getState();
      expect(trackHistory).toHaveLength(3);
      expect(trackHistory.map(t => t.id)).toEqual(['track-a', 'track-b', 'track-c']);
      expect(currentTrack?.id).toBe('track-d');
    });
  });

  describe('Backward skip handling', () => {
    test('pushes current track to futureQueue and pops from history', () => {
      const store = usePlayerStore;

      store.setState({
        currentTrack: trackB,
        trackHistory: [trackA],
        futureQueue: [],
      });

      const { pushToFuture, popFromHistory, setCurrentTrack } = store.getState();

      pushToFuture(trackB);
      const prevTrack = popFromHistory();
      if (prevTrack) setCurrentTrack(prevTrack);

      const state = store.getState();
      expect(state.currentTrack?.id).toBe('track-a');
      expect(state.futureQueue).toHaveLength(1);
      expect(state.futureQueue[0].id).toBe('track-b');
      expect(state.trackHistory).toHaveLength(0);
    });

    test('futureQueue maintains LIFO order for correct forward replay', () => {
      const store = usePlayerStore;

      store.setState({
        currentTrack: trackC,
        trackHistory: [trackA, trackB],
        futureQueue: [],
      });

      const actions = store.getState();

      // Skip back: C -> B
      actions.pushToFuture(trackC);
      const prev1 = actions.popFromHistory();
      if (prev1) actions.setCurrentTrack(prev1);

      // Skip back: B -> A
      const actions2 = store.getState();
      actions2.pushToFuture(prev1!);
      const prev2 = actions2.popFromHistory();
      if (prev2) actions2.setCurrentTrack(prev2);

      const state = store.getState();
      expect(state.currentTrack?.id).toBe('track-a');
      expect(state.futureQueue.map(t => t.id)).toEqual(['track-b', 'track-c']);
      expect(state.trackHistory).toHaveLength(0);
    });

    test('popFromHistory returns undefined when history is empty', () => {
      const { popFromHistory } = usePlayerStore.getState();
      const result = popFromHistory();

      expect(result).toBeUndefined();
      expect(usePlayerStore.getState().trackHistory).toHaveLength(0);
    });

    test('popFromFuture returns undefined when futureQueue is empty', () => {
      const { popFromFuture } = usePlayerStore.getState();
      const result = popFromFuture();

      expect(result).toBeUndefined();
      expect(usePlayerStore.getState().futureQueue).toHaveLength(0);
    });
  });

  describe('playedTrackIds tracking', () => {
    test('appends a new track ID to the playedTrackIds array', () => {
      const { addPlayedTrack } = usePlayerStore.getState();

      addPlayedTrack('track-a');
      addPlayedTrack('track-b');
      addPlayedTrack('track-c');

      const { playedTrackIds } = usePlayerStore.getState();
      expect(playedTrackIds).toHaveLength(3);
      expect(playedTrackIds).toEqual(['track-a', 'track-b', 'track-c']);
    });

    test('does not add duplicate track IDs (idempotency)', () => {
      const { addPlayedTrack } = usePlayerStore.getState();

      addPlayedTrack('track-a');
      addPlayedTrack('track-a');
      addPlayedTrack('track-b');
      addPlayedTrack('track-b');

      const { playedTrackIds } = usePlayerStore.getState();
      expect(playedTrackIds).toHaveLength(2);
      expect(playedTrackIds).toEqual(['track-a', 'track-b']);
    });

    test('preserves insertion order', () => {
      const { addPlayedTrack } = usePlayerStore.getState();

      addPlayedTrack('track-c');
      addPlayedTrack('track-a');
      addPlayedTrack('track-b');

      const { playedTrackIds } = usePlayerStore.getState();
      expect(playedTrackIds).toEqual(['track-c', 'track-a', 'track-b']);
    });
  });

  describe('Candidate Pool Management', () => {
    test('setCandidatePool replaces the pool atomically', () => {
      const { setCandidatePool } = usePlayerStore.getState();

      const pool = [trackA, trackB, trackC];
      setCandidatePool(pool);

      const state = usePlayerStore.getState();
      expect(state.candidatePool).toHaveLength(3);
      expect(state.candidatePool.map(t => t.id)).toEqual(['track-a', 'track-b', 'track-c']);
    });

    test('setting a new pool replaces — not appends to — the old one', () => {
      const { setCandidatePool } = usePlayerStore.getState();

      setCandidatePool([trackA, trackB]);
      setCandidatePool([trackC, trackD]);

      const { candidatePool } = usePlayerStore.getState();
      expect(candidatePool).toHaveLength(2);
      expect(candidatePool.map(t => t.id)).toEqual(['track-c', 'track-d']);
    });
  });

  describe('Genre Selection', () => {
    test('setSelectedGenre updates the genre', () => {
      const { setSelectedGenre } = usePlayerStore.getState();

      setSelectedGenre('hip-hop');
      expect(usePlayerStore.getState().selectedGenre).toBe('hip-hop');

      setSelectedGenre('jazz');
      expect(usePlayerStore.getState().selectedGenre).toBe('jazz');
    });

    test('setSelectedGenre can be cleared to null', () => {
      const { setSelectedGenre } = usePlayerStore.getState();

      setSelectedGenre('rock');
      expect(usePlayerStore.getState().selectedGenre).toBe('rock');

      setSelectedGenre(null);
      expect(usePlayerStore.getState().selectedGenre).toBeNull();
    });
  });

  describe('clearFuture', () => {
    test('empties the futureQueue', () => {
      usePlayerStore.setState({ futureQueue: [trackA, trackB, trackC] });

      const { clearFuture } = usePlayerStore.getState();
      clearFuture();

      expect(usePlayerStore.getState().futureQueue).toHaveLength(0);
    });
  });
});
