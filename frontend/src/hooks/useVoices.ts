import { useState, useEffect } from "react";

/**
 * Returns all English voices available in the browser, sorted with
 * higher-quality voices (Premium / Enhanced) first, then alphabetically.
 * Handles the async `voiceschanged` event that browsers fire when voices finish loading.
 */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    function load() {
      const all = window.speechSynthesis.getVoices().filter((v) =>
        v.lang.startsWith("en")
      );

      // Sort: Premium > Enhanced > standard; ties broken alphabetically by name
      all.sort((a, b) => {
        const rank = (name: string) => {
          if (name.includes("Premium")) return 0;
          if (name.includes("Enhanced")) return 1;
          return 2;
        };
        const diff = rank(a.name) - rank(b.name);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

      setVoices(all);
    }

    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  return voices;
}
