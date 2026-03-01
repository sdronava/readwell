interface Props {
  speaking: boolean;
  onPlay: () => void;
  onStop: () => void;
}

export function TtsControls({ speaking, onPlay, onStop }: Props) {
  return (
    <div className="flex items-center gap-2">
      {speaking ? (
        <button
          onClick={onStop}
          className="px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium"
        >
          ⏹ Stop
        </button>
      ) : (
        <button
          onClick={onPlay}
          className="px-3 py-1.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium"
        >
          ▶ Read Aloud
        </button>
      )}
    </div>
  );
}
