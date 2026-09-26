import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mocks
const mockPushToHistory = jest.fn();
const mockPopFromHistory = jest.fn();
const mockPopFromFuture = jest.fn();
const mockPushToFuture = jest.fn();
const mockSetCurrentTrack = jest.fn();
const mockSetNextTrackId = jest.fn();
const mockAddPlayedTrack = jest.fn();

const mockUsePlayerStore = jest.fn() as jest.Mock & { getState: jest.Mock };
mockUsePlayerStore.getState = jest.fn().mockReturnValue({ playedTrackIds: [] });

jest.mock('@/store/usePlayerStore', () => ({
  usePlayerStore: Object.assign(
    (...args: unknown[]) => mockUsePlayerStore(...args),
    { getState: (...args: unknown[]) => mockUsePlayerStore.getState(...args) },
  ),
}));

const mockFetchRecommendation = jest.fn();
jest.mock('@/lib/api', () => ({
  fetchRecommendation: (...args: unknown[]) => mockFetchRecommendation(...args),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock lucide icons as simple spans with testids
jest.mock('lucide-react', () => ({
  Play: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-play', ...props }),
  Pause: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-pause', ...props }),
  SkipForward: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-skip-forward', ...props }),
  SkipBack: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-skip-back', ...props }),
  Volume2: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-volume', ...props }),
  VolumeX: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-volume-x', ...props }),
  Music: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'icon-music', ...props }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('button', props, children),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ onValueChange, ...props }: { onValueChange?: unknown; [key: string]: unknown }) =>
    React.createElement('input', { type: 'range', 'data-testid': 'slider', onChange: () => {}, ...props }),
}));

import { SmartPlayer } from '@/components/SmartPlayer';

function createDefaultStoreReturn(overrides: Record<string, unknown> = {}) {
  return {
    currentTrack: null,
    setCurrentTrack: mockSetCurrentTrack,
    candidatePool: [],
    nextTrackId: null,
    setNextTrackId: mockSetNextTrackId,
    trackHistory: [],
    pushToHistory: mockPushToHistory,
    popFromHistory: mockPopFromHistory,
    futureQueue: [],
    pushToFuture: mockPushToFuture,
    popFromFuture: mockPopFromFuture,
    addPlayedTrack: mockAddPlayedTrack,
    ...overrides,
  };
}

function createMockTrack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-track-1',
    name: 'Test Track Alpha',
    artists: [{ name: 'Test Artist' }],
    album: { images: [{ url: 'https://img.example.com/album.jpg' }] },
    preview_url: 'https://preview.example.com/test.mp3',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchRecommendation.mockResolvedValue({ next_track_id: null });
  mockUsePlayerStore.getState.mockReturnValue({ playedTrackIds: [] });
});

describe('SmartPlayer', () => {
  test('renders nothing when currentTrack is null', () => {
    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: null,
    }));

    const { container } = render(React.createElement(SmartPlayer));
    expect(container.innerHTML).toBe('');
  });

  test('displays track name, artist, and album art for the active track', () => {
    const track = createMockTrack({
      name: 'Midnight Synth',
      artists: [{ name: 'Neon Dreams' }, { name: 'Crystal Waves' }],
    });

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: track,
    }));

    render(React.createElement(SmartPlayer));

    expect(screen.getByText('Midnight Synth')).toBeInTheDocument();
    expect(screen.getByText('Neon Dreams, Crystal Waves')).toBeInTheDocument();
  });

  test('shows "Analyzing vectors..." when nextTrackId is not yet resolved', async () => {
    let resolveRecommendation!: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveRecommendation = resolve;
    });
    mockFetchRecommendation.mockReturnValue(pendingPromise);

    const track = createMockTrack();

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: track,
      candidatePool: [
        track,
        createMockTrack({ id: 'candidate-1', name: 'Candidate One' }),
      ],
      nextTrackId: null,
    }));

    render(React.createElement(SmartPlayer));

    expect(screen.getByText('Up Next')).toBeInTheDocument();
    expect(screen.getByText('Analyzing vectors...')).toBeInTheDocument();

    await act(async () => {
      resolveRecommendation({ next_track_id: 'candidate-1' });
    });
  });

  test('displays the next track name when nextTrackId is resolved', () => {
    const currentTrack = createMockTrack({ id: 'current-1', name: 'Current Song' });
    const nextTrackObj = createMockTrack({ id: 'next-1', name: 'Upcoming Banger' });

    mockFetchRecommendation.mockResolvedValue({ next_track_id: 'next-1' });

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack,
      candidatePool: [currentTrack, nextTrackObj],
      nextTrackId: 'next-1',
      futureQueue: [nextTrackObj],
    }));

    render(React.createElement(SmartPlayer));

    expect(screen.getByText('Upcoming Banger')).toBeInTheDocument();
    expect(screen.queryByText('Analyzing vectors...')).not.toBeInTheDocument();
  });

  test('displays "End of queue" when no next track is available', () => {
    const currentTrack = createMockTrack();

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack,
      candidatePool: [currentTrack],
      nextTrackId: null,
      futureQueue: [currentTrack],
    }));

    render(React.createElement(SmartPlayer));

    expect(screen.getByText('End of queue')).toBeInTheDocument();
  });

  test('immediately triggers skip when currentTrack has no preview_url', () => {
    const noPreviewTrack = createMockTrack({
      id: 'no-preview',
      name: 'Silent Track',
      preview_url: null,
    });

    const fallbackTrack = createMockTrack({
      id: 'fallback',
      name: 'Fallback Track',
    });

    mockPopFromFuture.mockReturnValue(undefined);

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: noPreviewTrack,
      candidatePool: [noPreviewTrack, fallbackTrack],
      nextTrackId: 'fallback',
    }));

    render(React.createElement(SmartPlayer));

    expect(mockPushToHistory).toHaveBeenCalledWith(noPreviewTrack);
    expect(mockSetCurrentTrack).toHaveBeenCalled();
  });

  test('does NOT auto-skip when preview_url is present', () => {
    const playableTrack = createMockTrack({
      id: 'playable',
      name: 'Playable Track',
      preview_url: 'https://preview.example.com/playable.mp3',
    });

    mockFetchRecommendation.mockResolvedValue({ next_track_id: null });

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: playableTrack,
      candidatePool: [playableTrack],
    }));

    render(React.createElement(SmartPlayer));

    expect(mockPushToHistory).not.toHaveBeenCalled();
  });

  test('skip back button is disabled when trackHistory is empty', () => {
    const track = createMockTrack();

    mockFetchRecommendation.mockResolvedValue({ next_track_id: null });

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: track,
      candidatePool: [track],
      trackHistory: [],
    }));

    render(React.createElement(SmartPlayer));

    const skipBackButton = screen.getByTestId('icon-skip-back').closest('button');
    expect(skipBackButton).toBeDisabled();
  });

  test('skip back button is enabled when trackHistory has entries', () => {
    const track = createMockTrack();
    const prevTrack = createMockTrack({ id: 'prev', name: 'Previous Track' });

    mockFetchRecommendation.mockResolvedValue({ next_track_id: null });

    mockUsePlayerStore.mockReturnValue(createDefaultStoreReturn({
      currentTrack: track,
      candidatePool: [track],
      trackHistory: [prevTrack],
      futureQueue: [track],
    }));

    render(React.createElement(SmartPlayer));

    const skipBackButton = screen.getByTestId('icon-skip-back').closest('button');
    expect(skipBackButton).not.toBeDisabled();
  });
});
