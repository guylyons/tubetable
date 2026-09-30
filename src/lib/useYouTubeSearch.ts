import { useDeferredValue, useEffect, useState } from "react";
import type { YouTubeSearchPayload, YouTubeSearchResult } from "../types";
import { parseYouTubeVideoId } from "./youtube";

const SEARCH_DEBOUNCE_MS = 220;

export function useYouTubeSearch(query: string) {
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

    if (deferredQuery.length < 2 || parseYouTubeVideoId(deferredQuery)) {
      setResults([]);
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Searching from the first keystroke hides stale results and keeps "Add top result" from using them.
    setIsSearching(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as YouTubeSearchPayload & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "YouTube search is temporarily unavailable.");
        }

        setResults(data.results);
        setSuggestions(data.suggestions);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSuggestions([]);
          setError(searchError instanceof Error ? searchError.message : "Unable to search YouTube right now.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deferredQuery]);

  return { deferredQuery, error, isSearching, results, suggestions };
}
