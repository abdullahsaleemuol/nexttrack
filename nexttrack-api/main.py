import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

# Pull in the core recommendation engine logic
from recommendation import RecommendationRequest, RecommendationResponse, get_best_recommendation

load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
RAPIDAPI_HOST = "spotify-extended-audio-features-api.p.rapidapi.com"

app = FastAPI(title="NextTrack API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_rapidapi_headers():
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY missing from environment")
    return {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }

@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "message": "Pure RapidAPI Radio Active"}

@app.get("/api/v1/genres")
async def get_genres():
    """Fetch the dynamic list of genre seeds to populate the frontend UI."""
    url = f"https://{RAPIDAPI_HOST}/v1/recommendations/available-genre-seeds"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=get_rapidapi_headers())
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch genres")
        return response.json()

@app.get("/api/v1/pool")
async def get_candidate_pool(genre: str = Query(..., description="Genre to seed the pool")):
    """Retrieve a pool of up to 50 candidate tracks based on the selected genre."""
    url = f"https://{RAPIDAPI_HOST}/v1/recommendations"
    params = {
        "seed_genres": genre,
        "limit": 50
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=get_rapidapi_headers(), params=params)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch candidate pool")
        
        data = response.json()
        return {"tracks": data.get("tracks", [])}

@app.post("/api/v1/recommend", response_model=RecommendationResponse)
async def recommend_next_track(request: RecommendationRequest):
    """Handle the core recommendation loop to find the best next track."""
    # Forward the request directly to the recommendation engine. No tokens required here.
    return await get_best_recommendation(request)