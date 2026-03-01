import { useReaderSettings } from "../contexts/ReaderSettingsContext";
import { useVoices } from "../hooks/useVoices";

interface Props {
  speaking: boolean;
  onPlay: () => void;
  onStop: () => void;
}

const RATES = [
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
] as const;

/** Strip quality suffixes for the compact dropdown label, keep full name in tooltip */
function shortName(name: string): string {
  return name.replace(/\s*\((Enhanced|Premium|Compact)\)\s*$/, "");
}

export function TtsControls({ speaking, onPlay, onStop }: Props) {
  const { ttsRate, setTtsRate, voiceURI, setVoiceURI } = useReaderSettings();
  const voices = useVoices();

  const selectClass =
    "text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="flex items-center gap-2">
      {/* Voice selector — hidden until voices load */}
      {voices.length > 0 && (
        <select
          value={voiceURI}
          onChange={(e) => setVoiceURI(e.target.value)}
          aria-label="TTS voice"
          title="Select voice"
          className={`${selectClass} max-w-[130px] truncate`}
        >
          <option value="">Default</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI} title={`${v.name} (${v.lang})`}>
              {shortName(v.name)}
            </option>
          ))}
        </select>
      )}

      {/* Speed selector */}
      <select
        value={ttsRate}
        onChange={(e) => setTtsRate(Number(e.target.value) as typeof ttsRate)}
        aria-label="TTS speed"
        className={selectClass}
      >
        {RATES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {speaking ? (
        <button
          onClick={onStop}
          aria-label="Stop reading aloud"
          className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-sm font-medium transition-colors"
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          onClick={onPlay}
          aria-label="Read page aloud"
          className="px-3 py-1.5 rounded-lg bg-brand-100 dark:bg-brand-700/30 hover:bg-brand-200 dark:hover:bg-brand-700/50 text-brand-700 dark:text-brand-200 text-sm font-medium transition-colors"
        >
          ▶ Read Aloud
        </button>
      )}
    </div>
  );
}
