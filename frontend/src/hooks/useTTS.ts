import { useRef, useState, useCallback, useEffect } from "react";
import type { Block } from "../types/blocks";

export function useTTS(
  blocks: Block[],
  rate: number = 1,
  voiceURI: string = "",
  onNaturalEnd?: () => void,
) {
  const [speaking, setSpeaking] = useState(false);
  const [highlightRange, setHighlightRange] = useState<{ start: number; length: number } | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // true when stop() was called explicitly; prevents treating cancel-triggered end as natural end
  const cancelledRef = useRef(false);
  // always holds the latest onNaturalEnd without forcing speak() to recreate
  const onNaturalEndRef = useRef(onNaturalEnd);
  useEffect(() => { onNaturalEndRef.current = onNaturalEnd; }, [onNaturalEnd]);

  const getReadableText = useCallback(() =>
    blocks
      .filter((b) => b.type === "paragraph" || b.type === "heading")
      .map((b) => (b as { text: string }).text)
      .join(" "),
    [blocks]
  );

  const speak = useCallback(() => {
    cancelledRef.current = false;
    window.speechSynthesis.cancel();
    const text = getReadableText();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;

    if (voiceURI) {
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
    }

    utteranceRef.current = utterance;

    utterance.addEventListener("boundary", (e: SpeechSynthesisEvent) => {
      if (e.name === "word") {
        setHighlightRange({ start: e.charIndex, length: e.charLength ?? 0 });
      }
    });

    utterance.addEventListener("end", () => {
      setSpeaking(false);
      setHighlightRange(null);
      if (!cancelledRef.current) {
        onNaturalEndRef.current?.();
      }
    });

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [getReadableText, rate, voiceURI]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setHighlightRange(null);
  }, []);

  return { speak, stop, speaking, highlightRange };
}
