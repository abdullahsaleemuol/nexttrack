import pytest
import numpy as np
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from recommendation import (
    calculate_cosine_similarity,
    get_best_recommendation,
    RecommendationRequest,
    RecommendationResponse,
)
from main import app


# --- Cosine Similarity Tests ---

class TestCalculateCosineSimilarity:

    def test_identical_vectors_return_perfect_similarity(self):
        # A vector compared with itself should give 1.0
        vec = np.array([0.8, 0.6, 0.7, 0.3])
        score = calculate_cosine_similarity(vec, vec)
        assert score == pytest.approx(1.0)

    def test_orthogonal_vectors_return_zero_similarity(self):
        # Vectors at 90 degrees should have zero similarity
        vec1 = np.array([1.0, 0.0, 0.0, 0.0])
        vec2 = np.array([0.0, 1.0, 0.0, 0.0])
        score = calculate_cosine_similarity(vec1, vec2)
        assert score == pytest.approx(0.0)

    def test_zero_vector_does_not_raise_division_error(self):
        # Protect against zero division when a vector has all zeros
        zero = np.array([0.0, 0.0, 0.0, 0.0])
        nonzero = np.array([0.5, 0.4, 0.9, 0.1])

        # Test both positions and both zero
        assert calculate_cosine_similarity(zero, nonzero) == 0.0
        assert calculate_cosine_similarity(nonzero, zero) == 0.0
        assert calculate_cosine_similarity(zero, zero) == 0.0

    def test_partially_similar_vectors_return_intermediate_score(self):
        # Realistic track vectors should give a score between 0 and 1
        vec1 = np.array([0.9, 0.2, 0.8, 0.1])
        vec2 = np.array([0.3, 0.7, 0.5, 0.6])
        score = calculate_cosine_similarity(vec1, vec2)
        assert 0.0 < score < 1.0

    def test_cosine_similarity_is_commutative(self):
        # Order shouldn't matter: sim(A, B) == sim(B, A)
        vec1 = np.array([0.6, 0.3, 0.9, 0.2])
        vec2 = np.array([0.1, 0.8, 0.4, 0.7])
        assert calculate_cosine_similarity(vec1, vec2) == pytest.approx(
            calculate_cosine_similarity(vec2, vec1)
        )

    def test_scalar_multiples_yield_perfect_similarity(self):
        # Cosine similarity measures angle/direction, not magnitude
        vec1 = np.array([0.4, 0.5, 0.6, 0.7])
        vec2 = 3.0 * vec1
        score = calculate_cosine_similarity(vec1, vec2)
        assert score == pytest.approx(1.0)

    def test_single_dimension_vectors(self):
        # Sanity check with single active dimensions
        a = np.array([0.0, 0.0, 1.0, 0.0])
        b = np.array([0.0, 0.0, 0.5, 0.0])
        c = np.array([0.0, 0.0, 0.0, 1.0])

        assert calculate_cosine_similarity(a, b) == pytest.approx(1.0)
        assert calculate_cosine_similarity(a, c) == pytest.approx(0.0)


# --- Recommendation Logic Tests ---

def _make_features(
    track_id: str,
    danceability: float = 0.5,
    energy: float = 0.5,
    valence: float = 0.5,
    acousticness: float = 0.5,
) -> dict:
    """Helper to mock track feature dicts returned by the API."""
    return {
        "id": track_id,
        "danceability": danceability,
        "energy": energy,
        "valence": valence,
        "acousticness": acousticness,
    }


class TestGetBestRecommendation:

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_selects_most_similar_candidate(self, mock_fetch):
        # Track A is closest in features to current track, should be picked
        current_id = "current_001"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.8, 0.6, 0.7, 0.3),
            "track_A": _make_features("track_A", 0.79, 0.61, 0.69, 0.31),
            "track_B": _make_features("track_B", 0.4, 0.3, 0.5, 0.8),
            "track_C": _make_features("track_C", 0.1, 0.9, 0.1, 0.9),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["track_A", "track_B", "track_C"],
        )

        result = await get_best_recommendation(request)

        assert isinstance(result, RecommendationResponse)
        assert result.next_track_id == "track_A"
        assert 0.0 < result.similarity_score <= 1.0

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_missing_candidates_are_skipped_gracefully(self, mock_fetch):
        # If some candidate tracks don't have feature data returned, skip them instead of breaking
        current_id = "current_002"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.5, 0.5, 0.5, 0.5),
            # Only track_B is returned by the API
            "track_B": _make_features("track_B", 0.6, 0.4, 0.7, 0.3),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["track_A", "track_B", "track_C"],
        )

        result = await get_best_recommendation(request)
        assert result.next_track_id == "track_B"
        assert result.similarity_score > 0.0

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_no_valid_candidates_raises_404(self, mock_fetch):
        # Should raise 404 if none of the candidate tracks have feature data
        current_id = "current_003"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.5, 0.5, 0.5, 0.5),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["missing_1", "missing_2", "missing_3"],
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_best_recommendation(request)

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Could not calculate a recommendation"

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_missing_current_track_raises_404(self, mock_fetch):
        # If current track features aren't found, raise 404 early
        mock_fetch.return_value = {
            "track_A": _make_features("track_A", 0.5, 0.5, 0.5, 0.5),
        }

        request = RecommendationRequest(
            current_track_id="current_004",
            candidate_track_ids=["track_A"],
        )

        with pytest.raises(HTTPException) as exc_info:
            await get_best_recommendation(request)

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Audio features not found for current track"

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_single_candidate_is_returned(self, mock_fetch):
        current_id = "current_005"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.9, 0.1, 0.8, 0.2),
            "only_candidate": _make_features("only_candidate", 0.1, 0.9, 0.2, 0.8),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["only_candidate"],
        )

        result = await get_best_recommendation(request)
        assert result.next_track_id == "only_candidate"

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_correct_ranking_among_many_candidates(self, mock_fetch):
        # Pick the best match out of a larger pool
        current_id = "current_006"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.7, 0.5, 0.6, 0.4),
            "track_A": _make_features("track_A", 0.1, 0.1, 0.1, 0.1),
            "track_B": _make_features("track_B", 0.3, 0.2, 0.4, 0.5),
            "track_C": _make_features("track_C", 0.5, 0.5, 0.5, 0.5),
            "track_D": _make_features("track_D", 0.6, 0.4, 0.5, 0.3),
            "track_E": _make_features("track_E", 0.7, 0.5, 0.6, 0.4),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["track_A", "track_B", "track_C", "track_D", "track_E"],
        )

        result = await get_best_recommendation(request)
        assert result.next_track_id == "track_E"
        assert result.similarity_score == pytest.approx(1.0, abs=1e-6)

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_mixed_present_and_missing_candidates(self, mock_fetch):
        # Mix of missing and present candidates, should select highest among available ones
        current_id = "current_007"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.8, 0.6, 0.7, 0.3),
            "track_B": _make_features("track_B", 0.5, 0.4, 0.6, 0.5),
            "track_D": _make_features("track_D", 0.78, 0.62, 0.68, 0.32),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=["track_A", "track_B", "track_C", "track_D"],
        )

        result = await get_best_recommendation(request)
        assert result.next_track_id == "track_D"

    @pytest.mark.asyncio
    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    async def test_fetch_called_with_all_ids(self, mock_fetch):
        # Ensure current track + candidates are all requested together in one batch
        current_id = "current_008"
        candidates = ["cand_1", "cand_2"]
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.5, 0.5, 0.5, 0.5),
            "cand_1": _make_features("cand_1", 0.6, 0.6, 0.6, 0.6),
            "cand_2": _make_features("cand_2", 0.4, 0.4, 0.4, 0.4),
        }

        request = RecommendationRequest(
            current_track_id=current_id,
            candidate_track_ids=candidates,
        )

        await get_best_recommendation(request)

        mock_fetch.assert_called_once()
        called_ids = mock_fetch.call_args[0][0]
        assert called_ids == [current_id] + candidates


# --- FastAPI Endpoint Tests ---

class TestFastAPIEndpoints:

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_health_endpoint_returns_200(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "healthy"
        assert "message" in body

    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    def test_recommend_endpoint_returns_best_track(self, mock_fetch, client):
        current_id = "api_current"
        mock_fetch.return_value = {
            current_id: _make_features(current_id, 0.7, 0.5, 0.6, 0.4),
            "api_cand_1": _make_features("api_cand_1", 0.71, 0.49, 0.61, 0.39),
            "api_cand_2": _make_features("api_cand_2", 0.1, 0.9, 0.1, 0.9),
        }

        response = client.post(
            "/api/v1/recommend",
            json={
                "current_track_id": current_id,
                "candidate_track_ids": ["api_cand_1", "api_cand_2"],
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["next_track_id"] == "api_cand_1"
        assert 0.0 < body["similarity_score"] <= 1.0

    @patch("recommendation.fetch_audio_features", new_callable=AsyncMock)
    def test_recommend_endpoint_returns_404_when_exhausted(self, mock_fetch, client):
        mock_fetch.return_value = {
            "api_current_2": _make_features("api_current_2", 0.5, 0.5, 0.5, 0.5),
        }

        response = client.post(
            "/api/v1/recommend",
            json={
                "current_track_id": "api_current_2",
                "candidate_track_ids": ["ghost_1", "ghost_2"],
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Could not calculate a recommendation"

    def test_recommend_endpoint_rejects_invalid_payload(self, client):
        response = client.post(
            "/api/v1/recommend",
            json={"current_track_id": "some_id"},
        )
        assert response.status_code == 422

    def test_nonexistent_route_returns_404(self, client):
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404


# --- Model Validation Tests ---

class TestPydanticModels:

    def test_valid_recommendation_request(self):
        req = RecommendationRequest(
            current_track_id="track_123",
            candidate_track_ids=["a", "b", "c"],
        )
        assert req.current_track_id == "track_123"
        assert len(req.candidate_track_ids) == 3

    def test_recommendation_request_rejects_missing_fields(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RecommendationRequest(current_track_id="track_123")

    def test_valid_recommendation_response(self):
        resp = RecommendationResponse(
            next_track_id="track_xyz",
            similarity_score=0.95,
        )
        assert resp.next_track_id == "track_xyz"
        assert resp.similarity_score == pytest.approx(0.95)

    def test_recommendation_response_coerces_score_to_float(self):
        resp = RecommendationResponse(
            next_track_id="track_abc",
            similarity_score=1,
        )
        assert isinstance(resp.similarity_score, float)
        assert resp.similarity_score == 1.0
