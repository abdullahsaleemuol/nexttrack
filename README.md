# NextTrack

## Overview

NextTrack is a stateless, session-based music recommendation RESTful API paired with a minimalist, interactive web application. Unlike dominant commercial platforms that rely on extensive long-term user tracking and Collaborative Filtering (CF) to generate playlists, NextTrack operates entirely without persistent user accounts or historical profiles.

By utilizing Content-Based Filtering (CBF) and Cosine Similarity mathematics on intrinsic audio feature vectors (such as danceability, energy, valence, and acousticness), NextTrack dynamically predicts and queues the most contextually appropriate "next track." This provides an "Endless Radio" experience that adapts instantly to a user's current mood while strictly preserving data privacy.

## Core Features

* **Stateless Architecture:** Eliminates data harvesting and profile pollution. The system requires no user authentication or database storage.
* **Session-Based Recommendations:** Adapts to the user's immediate listening context rather than historical averages, preventing algorithmic "filter bubbles."
* **Audio-Feature Mathematical Engine:** Employs Cosine Similarity on multi-dimensional audio vectors to accurately determine seamless track transitions.
* **Echo-Chamber Prevention:** The frontend explicitly manages playback history, allowing the backend to filter out previously played tracks and prevent algorithmic looping.
* **Local State Caching:** Utilizes local storage persistence to reduce redundant API calls and maintain the user's radio queue across browser refreshes.
* **Asynchronous Processing:** The backend utilizes parallel HTTP requests to bypass third-party rate limits, minimizing recommendation latency.

## Technology Stack

This repository contains both the backend API and the frontend web client.

### Frontend
* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS
* **State Management:** Zustand (with local storage `persist` middleware)
* **UI Components:** shadcn/ui
* **Icons:** Lucide React

### Backend
* **Framework:** Python, FastAPI, Uvicorn
* **Mathematics:** NumPy
* **Network / Async:** HTTPX, Asyncio
* **Validation:** Pydantic
* **External Integration:** RapidAPI (Spotify Extended Audio Features)

## Getting Started

### Prerequisites
* Node.js (v16 or higher)
* Python (3.8 or higher)
* RapidAPI Key (Subscribed to the Spotify Extended Audio Features API)

### 1. Backend Setup

1. Navigate to the backend directory (or root if running from the root level).
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate


3. Install the required Python packages:
```bash
pip install fastapi uvicorn httpx numpy pydantic python-dotenv

```


4. Create a `.env` file in the same directory as `main.py` and add your RapidAPI key:
```env
RAPIDAPI_KEY=your_rapidapi_key_here

```


5. Start the FastAPI development server:
```bash
uvicorn main:app --reload --port 8000

```


The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

### 2. Frontend Setup

1. Navigate to the frontend directory.
2. Install the Node dependencies:
```bash
npm install

```


3. Start the Next.js development server:
```bash
npm run dev

```


The web application will be accessible at `http://localhost:3000`.

## API Endpoints

The backend exposes the following RESTful endpoints:

* `GET /api/v1/health`: Diagnostic endpoint to confirm the API is operational.
* `GET /api/v1/genres`: Fetches a dynamic list of available music genre seeds.
* `GET /api/v1/pool`: Generates an initial pool of 50 candidate tracks based on a provided `genre` query parameter.
* `POST /api/v1/recommend`: The core mathematical engine. Accepts a JSON payload containing `current_track_id`, an array of `candidate_track_ids`, and an array of `played_track_ids`. Returns the optimal `next_track_id` and its similarity score.

## Recommendation Engine Mechanics

NextTrack explicitly rejects Collaborative Filtering in favor of a mathematically driven Content-Based approach. When the `/recommend` endpoint is called, the backend fetches the audio features for both the current track and all remaining unplayed candidate tracks.

The system isolates specific vectors (danceability, energy, valence, acousticness) and applies **Cosine Similarity** to measure the multidimensional distance between the current track and each candidate. The candidate with the highest similarity score—provided it does not exist in the `played_track_ids` exclusion array—is returned as the next track in the queue.
