import { useRef, useState, useCallback } from "react";
import type { Block } from "../types/blocks";

export function useTTS(blocks: Block[]) {
  const [speaking, setSpeaking] = useState(false);
  const [highlightRange, setHighlightRange] = useState<{ start: number; length: number } | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const getReadableText = useCallback(() =>
    blocks
      .filter((b) => b.type === "paragraph" || b.type === "heading")
      .map((b) => (b as { text: string }).text)
      .join(" "),
    [blocks]
  );

  const speak = useCallback(() => {
    window.speechSynthesis.cancel();
    const text = getReadableText();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    utterance.addEventListener("boundary", (e: SpeechSynthesisEvent) => {
      if (e.name === "word") {
        setHighlightRange({ start: e.charIndex, length: e.charLength ?? 0 });
      }
    });

    utterance.addEventListener("end", () => {
      setSpeaking(false);
      setHighlightRange(null);
    });

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [getReadableText]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setHighlightRange(null);
  }, []);

  return { speak, stop, speaking, highlightRange };
}
