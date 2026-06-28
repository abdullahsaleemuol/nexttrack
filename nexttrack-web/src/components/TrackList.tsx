"use client";

import { useEffect, useState } from "react";
import { usePlayerStore, Track } from "@/store/usePlayerStore";
import { fetchPool } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Play, ArrowLeft } from "lucide-react";

export function TrackList() {
  const [loading, setLoading] = useState(false);
  
  const { 
    selectedGenre,
    setSelectedGenre,
    candidatePool, 
    setCandidatePool, 
    currentTrack,
    setCurrentTrack 
  } = usePlayerStore();

  // Kick the user back to the genre selection screen and clear out the current state
  const handleBack = () => {
    setCurrentTrack(null);
    setSelectedGenre(null);
    setCandidatePool([]);
  };

  // Fetch the initial pool of tracks for the selected genre as soon as this component mounts
  useEffect(() => {
    async function loadPool() {
      if (!selectedGenre || candidatePool.length > 0) return;
      
      setLoading(true);
      try {
        const data = await fetchPool(selectedGenre);
        console.log(`[API CALL] Fetched ${data.tracks.length} tracks for genre '${selectedGenre}':`, data.tracks.map((t: Track) => t.name));
        setCandidatePool(data.tracks);
      } catch (error) {
        console.error("Failed to load pool:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPool();
  }, [selectedGenre, candidatePool.length, setCandidatePool]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-8 animate-in fade-in duration-500 pb-32">
      <div className="flex items-center mb-8 px-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={handleBack}
          className="mr-6 rounded-full hover:bg-secondary h-10 w-10 flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold capitalize">{selectedGenre?.replace(/-/g, ' ')} Radio</h2>
          <p className="text-muted-foreground">Select a track to start the endless player</p>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)] rounded-3xl bg-card/30 border border-border/50 p-4">
        <div className="space-y-2">
          {candidatePool.map((track) => (
            <div
              key={track.id}
              onClick={() => {
                usePlayerStore.getState().clearFuture();
                setCurrentTrack(track);
              }}
              className={`group flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 hover:bg-card/80 ${
                currentTrack?.id === track.id ? "bg-primary/10 border-primary/20" : "border-transparent"
              } border`}
            >
              <div className="relative h-14 w-14 rounded-xl overflow-hidden mr-4 flex-shrink-0 bg-muted">
                {track.album?.images?.[0]?.url && (
                  <img 
                    src={track.album.images[0].url} 
                    alt={track.name} 
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play fill="currentColor" className="text-white w-6 h-6" />
                </div>
              </div>
              
              <div className="flex-grow min-w-0">
                <h3 className={`font-semibold truncate ${currentTrack?.id === track.id ? "text-primary" : ""}`}>
                  {track.name}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {track.artists.map(a => a.name).join(", ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
