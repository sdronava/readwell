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
}

const ReaderSettingsContext = createContext<ReaderSettingsValue>({
  fontSize: "base",
  setFontSize: () => {},
  fontFamily: "reading",
  setFontFamily: () => {},
  ttsRate: 1,
  setTtsRate: () => {},
});

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [fontFamily, setFontFamily] = useState<FontFamily>("reading");
  const [ttsRate, setTtsRate] = useState<TtsRate>(1);

  return (
    <ReaderSettingsContext.Provider
      value={{ fontSize, setFontSize, fontFamily, setFontFamily, ttsRate, setTtsRate }}
    >
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  return useContext(ReaderSettingsContext);
}
