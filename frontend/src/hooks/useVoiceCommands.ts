import { useState, useCallback, useEffect, useRef } from 'react'
import type { VoiceCommand } from '../types/voiceCommands'

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (s1: string, s2: string): number => {
  const len1 = s1.length
  const len2 = s2.length
  const d: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  for (let i = 0; i <= len1; i++) d[i][0] = i
  for (let j = 0; j <= len2; j++) d[0][j] = j

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[len1][len2]
}

// Command definitions
const COMMAND_GROUPS = {
  play: ['read aloud', 'read', 'play', 'start'],
  pause: ['pause'],
  resume: ['resume', 'continue'],
  stop: ['stop', 'stop reading', 'stop it'],
  faster: ['faster', 'faster!', 'speed up'],
  slower: ['slower', 'slow down'],
  speed_normal: ['normal speed', 'normal', 'regular speed'],
  next_page: ['next', 'next page', 'next page please'],
  previous_page: ['previous', 'previous page', 'back', 'page back'],
}

const ALL_COMMANDS = Object.values(COMMAND_GROUPS).flat()

interface UseVoiceCommandsOptions {
  onCommand?: (command: VoiceCommand) => void
  language?: string
  confidenceThreshold?: number
}

interface UseVoiceCommandsReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  confidence: number
  error: string | null
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
  getConfidencePercentage: () => string
}

export const useVoiceCommands = ({
  onCommand,
  language = 'en-US',
  confidenceThreshold = 0.8,
}: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      setError('Speech Recognition API is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.language = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      finalTranscriptRef.current = ''
      setTranscript('')
      setInterimTranscript('')
      setConfidence(0)
    }

    recognition.onresult = (event: any) => {
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript
        const isFinal = event.results[i].isFinal

        if (isFinal) {
          finalTranscriptRef.current += transcriptSegment + ' '
          const conf = event.results[i][0].confidence
          setConfidence(conf)
        } else {
          interimText += transcriptSegment
        }
      }

      setInterimTranscript(interimText)
      setTranscript(finalTranscriptRef.current.trim())
    }

    recognition.onerror = (event: any) => {
      let errorMessage = 'An error occurred in speech recognition.'
      if (event.error === 'network') {
        errorMessage = 'Network error. Check your connection.'
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Microphone permission denied.'
      } else if (event.error === 'no-speech') {
        errorMessage = 'No speech detected.'
      }
      setError(errorMessage)
    }

    recognition.onend = () => {
      setIsListening(false)

      // Process final transcript if confidence is high enough
      if (finalTranscriptRef.current.trim() && confidence >= confidenceThreshold) {
        const recognized = recognizeCommand(finalTranscriptRef.current)
        if (recognized && onCommand) {
          onCommand({
            ...recognized,
            confidence,
          })
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [onCommand, language, confidenceThreshold])

  const recognizeCommand = (input: string): Omit<VoiceCommand, 'confidence'> | null => {
    const normalized = input.toLowerCase().trim()

    // Check for page number command: "page X"
    const pageMatch = normalized.match(/page\s+(\d+)/)
    if (pageMatch) {
      return {
        type: 'goto_page',
        transcript: normalized,
        pageNumber: parseInt(pageMatch[1], 10),
      }
    }

    // Try exact match first
    for (const [cmdType, patterns] of Object.entries(COMMAND_GROUPS)) {
      if (patterns.includes(normalized)) {
        return {
          type: cmdType as VoiceCommand['type'],
          transcript: normalized,
        }
      }
    }

    // Try fuzzy matching with edit distance
    let bestMatch: [string, string] | null = null
    let bestDistance = 2

    for (const command of ALL_COMMANDS) {
      const distance = levenshteinDistance(normalized, command)
      if (distance < bestDistance) {
        bestDistance = distance
        bestMatch = [command, normalized]
      }
    }

    if (bestMatch) {
      const command = bestMatch[0]
      for (const [cmdType, patterns] of Object.entries(COMMAND_GROUPS)) {
        if (patterns.includes(command)) {
          return {
            type: cmdType as VoiceCommand['type'],
            transcript: bestMatch[1],
          }
        }
      }
    }

    return null
  }

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && isSupported) {
      try {
        setError(null)
        finalTranscriptRef.current = ''
        recognitionRef.current.start()
      } catch (err) {
        // Already listening, ignore error
      }
    }
  }, [isListening, isSupported])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        // Already stopped, ignore error
      }
    }
  }, [isListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    finalTranscriptRef.current = ''
  }, [])

  const getConfidencePercentage = useCallback(() => {
    return `${Math.round(confidence * 100)}%`
  }, [confidence])

  return {
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
  }
}
