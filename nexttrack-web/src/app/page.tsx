"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { GenreSelector } from "@/components/GenreSelector";
import { TrackList } from "@/components/TrackList";
import { SmartPlayer } from "@/components/SmartPlayer";
import { Button } from "@/components/ui/button";
import { Disc3, Moon, Sun, ListMusic } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function Home() {
  const selectedGenre = usePlayerStore((state) => state.selectedGenre);
  const setSelectedGenre = usePlayerStore((state) => state.setSelectedGenre);
  const setCurrentTrack = usePlayerStore((state) => state.setCurrentTrack);
  const setCandidatePool = usePlayerStore((state) => state.setCandidatePool);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Wait for the component to mount on the client to avoid Next.js hydration errors with the theme
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  // Clear everything out and send the user back to the starting point
  const handleReset = () => {
    setCurrentTrack(null);
    setSelectedGenre(null);
    setCandidatePool([]);
  };

  return (
    <main className="min-h-screen flex flex-col relative bg-background">
      {/* Header */}
      <header className="p-6 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center gap-2 text-primary cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleReset}
            >
              <Disc3 className="w-8 h-8" />
              <span className="text-2xl font-black tracking-tighter">NextTrack</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {selectedGenre && (
              <Button 
                variant="outline" 
                onClick={handleReset}
                className="rounded-full px-5 hover:bg-secondary"
              >
                <ListMusic className="h-4 w-4 mr-2" />
                Select Genre
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-grow pt-8 px-4">
        {!selectedGenre ? <GenreSelector /> : <TrackList />}
      </div>

      {/* Persistent Player */}
      <SmartPlayer />
    </main>
  );
}
