import { fetchGenres, fetchPool, fetchRecommendation } from '@/lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

describe('fetchGenres', () => {
  test('returns parsed genre list on 200 OK', async () => {
    const mockResponse = { genres: ['hip-hop', 'jazz', 'electronic', 'rock'] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchGenres();

    expect(result).toEqual(mockResponse);
    expect(result.genres).toHaveLength(4);
    expect(result.genres).toContain('jazz');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/genres');
  });

  test('throws an error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchGenres()).rejects.toThrow('Failed to fetch genres');
  });

  test('propagates network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(fetchGenres()).rejects.toThrow('Network request failed');
  });
});

describe('fetchPool', () => {
  test('sends correctly encoded genre parameter and returns track pool', async () => {
    const mockPool = {
      tracks: [
        { id: 'track-1', name: 'Test Track 1' },
        { id: 'track-2', name: 'Test Track 2' },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPool,
    });

    const result = await fetchPool('hip-hop');

    expect(result).toEqual(mockPool);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/pool?genre=hip-hop'
    );
  });

  test('properly encodes genres with special characters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracks: [] }),
    });

    await fetchPool('R&B / Soul');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/pool?genre=R%26B%20%2F%20Soul'
    );
  });

  test('throws an error on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchPool('nonexistent-genre')).rejects.toThrow(
      'Failed to fetch track pool'
    );
  });
});

describe('fetchRecommendation', () => {
  test('sends correct POST body and returns next_track_id on 200 OK', async () => {
    const mockRecommendation = { next_track_id: 'track-42' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecommendation,
    });

    const result = await fetchRecommendation(
      'track-1',
      ['track-2', 'track-3', 'track-4'],
      ['track-0', 'track-1'],
    );

    expect(result).toEqual(mockRecommendation);
    expect(result.next_track_id).toBe('track-42');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/recommend',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_track_id: 'track-1',
          candidate_track_ids: ['track-2', 'track-3', 'track-4'],
          played_track_ids: ['track-0', 'track-1'],
        }),
      }
    );
  });

  test('defaults played_track_ids to empty array when omitted', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ next_track_id: 'track-5' }),
    });

    await fetchRecommendation('track-1', ['track-2', 'track-3']);

    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody.played_track_ids).toEqual([]);
  });

  test('throws an error on 500 Internal Server Error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      fetchRecommendation('track-1', ['track-2', 'track-3'])
    ).rejects.toThrow('Failed to fetch recommendation');
  });

  test('throws an error on 422 Validation Error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    });

    await expect(
      fetchRecommendation('track-1', [])
    ).rejects.toThrow('Failed to fetch recommendation');
  });

  test('propagates network-level errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      fetchRecommendation('track-1', ['track-2'])
    ).rejects.toThrow('Failed to fetch');
  });
});
