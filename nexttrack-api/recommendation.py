import os
import httpx
from pydantic import BaseModel
from typing import List, Dict
import numpy as np
from fastapi import HTTPException
import asyncio 

# API request schema for track recommendations
class RecommendationRequest(BaseModel):
    current_track_id: str
    candidate_track_ids: List[str]

# API response schema for track recommendations
class RecommendationResponse(BaseModel):
    next_track_id: str
    similarity_score: float


async def fetch_audio_features(track_ids: List[str]) -> Dict[str, dict]:
    """Fetches audio features in parallel chunks to avoid hitting rate limits."""
    RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")
    RAPIDAPI_HOST = "spotify-extended-audio-features-api.p.rapidapi.com"
    headers = {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST
    }
    
    url = f"https://{RAPIDAPI_HOST}/v1/audio-features"
    features_dict = {}
    
    chunk_size = 5
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Prepare async requests to execute concurrently
        tasks = []
        for i in range(0, len(track_ids), chunk_size):
            chunk = track_ids[i:i + chunk_size]
            params = {"ids": ",".join(chunk)}
            tasks.append(client.get(url, headers=headers, params=params))
            
        # Execute all requests
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process the results
        for response in responses:
            if isinstance(response, Exception):
                print(f"A request chunk failed: {response}")
                continue
                
            if response.status_code == 200:
                data = response.json()
                for feature in data.get("audio_features", []):
                    if feature:  # Ensure the feature data is not null
                        features_dict[feature["id"]] = feature
            else:
                print(f"\n--- AUDIO FEATURES ERROR ---")
                print(f"Status: {response.status_code} | Text: {response.text}")
                
    return features_dict

def calculate_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Calculates cosine similarity between two feature vectors."""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_product / (norm1 * norm2))

async def get_best_recommendation(request: RecommendationRequest) -> RecommendationResponse:
    """Finds the most similar track to the current one based on audio features."""
    
    # Combine current track and candidates to fetch all features in one go
    all_ids_to_fetch = [request.current_track_id] + request.candidate_track_ids
    features_dict = await fetch_audio_features(all_ids_to_fetch)
    
    # Extract the feature vector for the currently playing track
    current_features = features_dict.get(request.current_track_id)
    if not current_features:
        raise HTTPException(status_code=404, detail="Audio features not found for current track")
        
    # Define the vector space using key audio characteristics
    target_vector = np.array([
        current_features.get("danceability", 0),
        current_features.get("energy", 0),
        current_features.get("valence", 0),
        current_features.get("acousticness", 0)
    ])
    
    best_match_id = None
    best_score = -1.0
    
    # Iterate through candidates to find the highest similarity score
    for candidate_id in request.candidate_track_ids:
        candidate_features = features_dict.get(candidate_id)
        if not candidate_features:
            continue
            
        candidate_vector = np.array([
            candidate_features.get("danceability", 0),
            candidate_features.get("energy", 0),
            candidate_features.get("valence", 0),
            candidate_features.get("acousticness", 0)
        ])
        
        score = calculate_cosine_similarity(target_vector, candidate_vector)
        
        if score > best_score:
            best_score = score
            best_match_id = candidate_id
            
    if not best_match_id:
        raise HTTPException(status_code=404, detail="Could not calculate a recommendation")
        
    return RecommendationResponse(
        next_track_id=best_match_id, 
        similarity_score=best_score
    )