import { createContext, useContext, useState } from "react";

type FontSize = "sm" | "base" | "lg" | "xl";
type FontFamily = "sans" | "reading";
type TtsRate = 0.75 | 1 | 1.5 | 2;

interface ReaderSettingsValue {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  fontFamily: FontFamily;
  setFontFamily: (family: FontFamily) => void;
  ttsRate: TtsRate;
  setTtsRate: (rate: TtsRate) => void;
  /** voiceURI of the selected SpeechSynthesisVoice; empty string = browser default */
  voiceURI: string;
  setVoiceURI: (uri: string) => void;
  /** Automatically turn to the next page when TTS finishes reading */
  autoPageTurn: boolean;
  setAutoPageTurn: (enabled: boolean) => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsValue>({
  fontSize: "base",
  setFontSize: () => {},
  fontFamily: "reading",
  setFontFamily: () => {},
  ttsRate: 1,
  setTtsRate: () => {},
  voiceURI: "",
  setVoiceURI: () => {},
  autoPageTurn: true,
  setAutoPageTurn: () => {},
});

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("reading");
  const [ttsRate, setTtsRate] = useState<TtsRate>(1);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [autoPageTurn, setAutoPageTurn] = useState<boolean>(true);

  return (
    <ReaderSettingsContext.Provider
      value={{ fontSize, setFontSize, fontFamily, setFontFamily, ttsRate, setTtsRate, voiceURI, setVoiceURI, autoPageTurn, setAutoPageTurn }}
    >
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  return useContext(ReaderSettingsContext);
}
