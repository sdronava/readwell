import React, { useEffect, useRef } from 'react'
import { useVoiceCommands } from '../hooks/useVoiceCommands'
import type { VoiceCommand } from '../types/voiceCommands'

interface VoiceCommandListenerProps {
  onCommand: (command: VoiceCommand) => void
  onListeningStart?: () => void
  onListeningStop?: () => void
  feedbackType?: 'visual' | 'audio' | 'both'
}

export const VoiceCommandListener: React.FC<VoiceCommandListenerProps> = ({
  onCommand,
  onListeningStart,
  onListeningStop,
  feedbackType = 'both',
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    confidence,
    error,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    getConfidencePercentage,
  } = useVoiceCommands({ onCommand })

  const spacebarPressedRef = useRef(false)
  const lastHotkeyTimeRef = useRef(0)

  // Create beep sound on mount
  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  }, [])

  const playBeep = (type: 'start' | 'stop') => {
    if (feedbackType === 'audio' || feedbackType === 'both') {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      if (type === 'start') {
        oscillator.frequency.value = 800
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
      } else {
        oscillator.frequency.value = 600
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.15)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent spacebar scroll behavior
    if (e.code === 'Space' && isSupported) {
      e.preventDefault()
    }

    if (e.code === 'Space') {
      if (!spacebarPressedRef.current && !isListening) {
        const now = Date.now()
        // Debounce rapid presses
        if (now - lastHotkeyTimeRef.current > 200) {
          spacebarPressedRef.current = true
          lastHotkeyTimeRef.current = now
          clearTranscript()
          startListening()
          playBeep('start')
          onListeningStart?.()
        }
      }
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      if (spacebarPressedRef.current && isListening) {
        spacebarPressedRef.current = false
        stopListening()
        playBeep('stop')
        // Note: onListeningStop will be called after recognition processes
      }
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isListening, isSupported, startListening, stopListening, clearTranscript])

  // Notify when listening stops
  useEffect(() => {
    if (!isListening && spacebarPressedRef.current === false) {
      onListeningStop?.()
    }
  }, [isListening, onListeningStop])

  if (!isSupported) {
    return (
      <div className="fixed bottom-6 right-6 max-w-xs">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg text-sm">
          <p className="font-semibold">Voice commands not supported</p>
          <p className="text-xs mt-1">Your browser doesn't support the Web Speech API.</p>
        </div>
      </div>
    )
  }

  if (!isListening) {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 max-w-sm">
      <div className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg">
        {/* Header with listening indicator */}
        <div className="flex items-center gap-2 mb-2">
          {/* Waveform animation */}
          <div className="flex items-end gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full animate-pulse"
                style={{
                  height: `${8 + i * 4}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="font-semibold text-sm">Listening...</span>
        </div>

        {/* Transcript display */}
        <div className="bg-blue-600 dark:bg-blue-700 rounded px-3 py-2 mb-2 min-h-10">
          {/* Final transcript */}
          {transcript && (
            <p className="text-sm text-blue-50 mb-1">
              <span className="font-medium">You said: </span>
              {transcript}
            </p>
          )}

          {/* Interim transcript */}
          {interimTranscript && (
            <p className="text-sm text-blue-200 italic">
              {interimTranscript}
              <span className="animate-pulse">▌</span>
            </p>
          )}

          {/* Prompt if nothing detected yet */}
          {!transcript && !interimTranscript && (
            <p className="text-sm text-blue-200 italic">Speak your command...</p>
          )}
        </div>

        {/* Confidence display */}
        {confidence > 0 && (
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-blue-100">Confidence:</span>
            <span className="font-mono text-blue-50">{getConfidencePercentage()}</span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-100 px-2 py-1 rounded text-xs">
            {error}
          </div>
        )}

        {/* Help text */}
        <p className="text-xs text-blue-100 mt-2">Release spacebar to execute command</p>
      </div>
    </div>
  )
}
