const API_BASE = 'http://localhost:8000/api/v1';

// Pull the full list of supported genres straight from the backend
export async function fetchGenres(): Promise<{ genres: string[] }> {
  const res = await fetch(`${API_BASE}/genres`);
  if (!res.ok) {
    throw new Error('Failed to fetch genres');
  }
  return res.json();
}

// Grab a fresh pool of tracks for a specific genre to start playing from
export async function fetchPool(genre: string) {
  const res = await fetch(`${API_BASE}/pool?genre=${encodeURIComponent(genre)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch track pool');
  }
  return res.json();
}

// Ask our AI backend to figure out the best track to play next based on what's playing right now
// We pass in what we've already played so we don't end up looping
export async function fetchRecommendation(currentTrackId: string, candidateIds: string[], playedTrackIds: string[] = []) {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      current_track_id: currentTrackId,
      candidate_track_ids: candidateIds,
      played_track_ids: playedTrackIds,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch recommendation');
  }
  return res.json();
}
