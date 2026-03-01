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
});

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("reading");
  const [ttsRate, setTtsRate] = useState<TtsRate>(1);
  const [voiceURI, setVoiceURI] = useState<string>("");

  return (
    <ReaderSettingsContext.Provider
      value={{ fontSize, setFontSize, fontFamily, setFontFamily, ttsRate, setTtsRate, voiceURI, setVoiceURI }}
    >
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  return useContext(ReaderSettingsContext);
}
