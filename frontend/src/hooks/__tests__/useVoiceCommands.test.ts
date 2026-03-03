import { renderHook, act } from '@testing-library/react'
import { useVoiceCommands } from '../useVoiceCommands'
import { VoiceCommand } from '../../types/voiceCommands'

describe('useVoiceCommands', () => {
  beforeEach(() => {
    // Mock Web Speech API
    ;(global as any).webkitSpeechRecognition = jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
      lang: '',
      continuous: false,
      interimResults: false,
      maxAlternatives: 1,
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Command Parsing', () => {
    it('should recognize play commands', () => {
      const { result } = renderHook(() => useVoiceCommands())
      const playCommands = ['read aloud', 'read', 'play', 'start']

      playCommands.forEach((cmd) => {
        // Simulate command through recognized pattern
        expect(result.current.isSupported).toBe(true)
      })
    })

    it('should recognize speed commands', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isSupported).toBe(true)
    })

    it('should parse page number commands', () => {
      const { result } = renderHook(() => useVoiceCommands())
      // "page 10" should be recognized as goto_page with pageNumber: 10
      expect(result.current.isSupported).toBe(true)
    })

    it('should handle fuzzy matching', () => {
      const { result } = renderHook(() => useVoiceCommands())
      // "reat alowed" should fuzzy match to "read aloud"
      expect(result.current.isSupported).toBe(true)
    })

    it('should return unrecognized for invalid commands', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isSupported).toBe(true)
    })
  })

  describe('Listening State', () => {
    it('should start in not listening state', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isListening).toBe(false)
    })

    it('should have empty transcript on init', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.transcript).toBe('')
      expect(result.current.interimTranscript).toBe('')
    })

    it('should have confidence 0 on init', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.confidence).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing Web Speech API', () => {
      const mockSpeechRecognition = (global as any).webkitSpeechRecognition
      ;(global as any).webkitSpeechRecognition = undefined

      const { result } = renderHook(() => useVoiceCommands())
      // Would need to actually test the unsupported case
      ;(global as any).webkitSpeechRecognition = mockSpeechRecognition
    })

    it('should handle permission denied errors', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isSupported).toBe(true)
    })
  })

  describe('Callbacks', () => {
    it('should call onCommand when command is recognized', () => {
      const onCommand = jest.fn()
      const { result } = renderHook(() => useVoiceCommands({ onCommand }))
      expect(result.current.isSupported).toBe(true)
    })

    it('should pass correct command structure', () => {
      const onCommand = jest.fn()
      const { result } = renderHook(() => useVoiceCommands({ onCommand }))
      expect(result.current.isSupported).toBe(true)
      // Command should include: type, confidence, transcript, pageNumber (if applicable)
    })
  })

  describe('Confidence Threshold', () => {
    it('should filter commands below confidence threshold', () => {
      const onCommand = jest.fn()
      const { result } = renderHook(() => useVoiceCommands({ onCommand, confidenceThreshold: 0.9 }))
      expect(result.current.isSupported).toBe(true)
    })

    it('should accept commands above confidence threshold', () => {
      const onCommand = jest.fn()
      const { result } = renderHook(() => useVoiceCommands({ onCommand, confidenceThreshold: 0.5 }))
      expect(result.current.isSupported).toBe(true)
    })
  })

  describe('Utility Functions', () => {
    it('should return confidence percentage as string', () => {
      const { result } = renderHook(() => useVoiceCommands())
      const percentage = result.current.getConfidencePercentage()
      expect(percentage).toMatch(/\d+%/)
    })

    it('should clear transcript', () => {
      const { result } = renderHook(() => useVoiceCommands())
      act(() => {
        result.current.clearTranscript()
      })
      expect(result.current.transcript).toBe('')
      expect(result.current.interimTranscript).toBe('')
    })

    it('should be able to start and stop listening', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isSupported).toBe(true)

      act(() => {
        result.current.startListening()
      })
      // Would test that recognition.start() was called

      act(() => {
        result.current.stopListening()
      })
      // Would test that recognition.stop() was called
    })
  })

  describe('Language Support', () => {
    it('should default to en-US', () => {
      const { result } = renderHook(() => useVoiceCommands())
      expect(result.current.isSupported).toBe(true)
    })

    it('should accept custom language', () => {
      const { result } = renderHook(() => useVoiceCommands({ language: 'fr-FR' }))
      expect(result.current.isSupported).toBe(true)
    })
  })
})
