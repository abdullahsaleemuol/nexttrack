"use client";

import { useState } from "react";
import { fetchGenres } from "@/lib/api";
import { usePlayerStore } from "@/store/usePlayerStore";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Hardcoded initial list of popular genres to get things started quickly without an API hit
const INITIAL_GENRES = [
  "pop",
  "hip hop",
  "r&b",
  "rock",
  "edm",
  "country",
  "jazz",
  "classical",
  "lo-fi",
  "synthwave",
  "latin pop",
  "indie",
  "afrobeats",
  "k-pop",
  "metal",
];

export function GenreSelector() {
  const [additionalGenres, setAdditionalGenres] = useState<string[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasFetchedMore, setHasFetchedMore] = useState(false);
  const setSelectedGenre = usePlayerStore((state) => state.setSelectedGenre);

  // Hit the backend to fetch additional genres if the user isn't feeling the initial list
  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await fetchGenres();
      const additional = data.genres.filter(
        (g: string) => !INITIAL_GENRES.includes(g),
      );
      setAdditionalGenres(additional);
      setHasFetchedMore(true);
    } catch (error) {
      console.error("Failed to load genres:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-10 px-4 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-extrabold tracking-tight">
          What&apos;s your vibe?
        </h1>
        <p className="text-muted-foreground text-xl">
          Select a genre to start your endless streaming.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
        {INITIAL_GENRES.map((genre) => (
          <Button
            key={genre}
            variant="secondary"
            size="lg"
            className="rounded-lg px-8 py-6 text-lg capitalize font-medium shadow-sm hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95"
            onClick={() => setSelectedGenre(genre)}
          >
            {genre.replace(/-/g, " ")}
          </Button>
        ))}
      </div>

      {!hasFetchedMore && (
        <Button
          variant="outline"
          size="lg"
          className="rounded-lg px-8 py-6 text-lg font-medium shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 mt-4"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            "More Genres..."
          )}
        </Button>
      )}

      {hasFetchedMore && additionalGenres.length > 0 && (
        <div className="mt-12 pt-10 border-t border-border/50 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-center text-muted-foreground text-lg mb-8 font-medium">
            Explore More Genres
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {additionalGenres.map((genre) => (
              <Button
                key={genre}
                variant="outline"
                className="rounded-lg px-5 py-4 text-sm capitalize font-medium hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={() => setSelectedGenre(genre)}
              >
                {genre.replace(/-/g, " ")}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
