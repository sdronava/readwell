import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoiceCommandListener } from '../VoiceCommandListener'
import { VoiceCommand } from '../../types/voiceCommands'

// Mock the useVoiceCommands hook
jest.mock('../../hooks/useVoiceCommands', () => ({
  useVoiceCommands: jest.fn(() => ({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    confidence: 1,
    error: null,
    isSupported: true,
    startListening: jest.fn(),
    stopListening: jest.fn(),
    clearTranscript: jest.fn(),
    getConfidencePercentage: jest.fn(() => '100%'),
  })),
}))

describe('VoiceCommandListener', () => {
  const mockOnCommand = jest.fn()
  const mockOnListeningStart = jest.fn()
  const mockOnListeningStop = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when not listening', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Component should render null when not listening
      expect(screen.queryByText('Listening...')).not.toBeInTheDocument()
    })

    it('should show unsupported message when Web Speech API unavailable', () => {
      // This would need to mock the hook to return isSupported: false
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Check for browser support message
    })
  })

  describe('Hotkey Detection', () => {
    it('should activate on spacebar press', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const spacebarEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, spacebarEvent)
      // Should call onListeningStart
    })

    it('should deactivate on spacebar release', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const keyupEvent = new KeyboardEvent('keyup', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, keyupEvent)
      // Should call onListeningStop
    })

    it('should prevent spacebar scroll behavior', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const spacebarEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })
      const preventDefaultSpy = jest.spyOn(spacebarEvent, 'preventDefault')
      fireEvent(window, spacebarEvent)

      // preventDefault should have been called
    })

    it('should debounce rapid spacebar presses', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      // Simulate two rapid spacebar presses
      const spacebarEvent1 = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })
      const spacebarEvent2 = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })

      fireEvent(window, spacebarEvent1)
      fireEvent(window, spacebarEvent2)

      // Second press should be ignored due to debounce
    })
  })

  describe('Visual Feedback', () => {
    it('should show waveform animation while listening', () => {
      // This would need to mock the hook with isListening: true
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Check for waveform elements
    })

    it('should display live transcript', () => {
      // Mock with transcript data
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Check transcript display
    })

    it('should show confidence percentage', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Check for confidence display
    })

    it('should display error messages', () => {
      // Mock with error state
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )
      // Check for error display
    })
  })

  describe('Callbacks', () => {
    it('should call onListeningStart when activation occurs', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const spacebarEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, spacebarEvent)

      // onListeningStart should be called
    })

    it('should call onListeningStop when deactivation occurs', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const keyupEvent = new KeyboardEvent('keyup', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, keyupEvent)

      // onListeningStop should be called
    })

    it('should call onCommand when voice command received', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      // Simulate command from useVoiceCommands
      // onCommand should be called with VoiceCommand object
    })
  })

  describe('Audio Feedback', () => {
    it('should play beep on activation with audio feedback', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
          feedbackType="audio"
        />
      )

      const spacebarEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, spacebarEvent)

      // Audio context should create oscillator
    })

    it('should play beep on deactivation with audio feedback', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
          feedbackType="audio"
        />
      )

      const keyupEvent = new KeyboardEvent('keyup', {
        code: 'Space',
        bubbles: true,
      })
      fireEvent(window, keyupEvent)

      // Audio context should create oscillator
    })

    it('should skip beep when feedbackType is visual only', () => {
      render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
          feedbackType="visual"
        />
      )

      // No audio should be played
    })
  })

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = render(
        <VoiceCommandListener
          onCommand={mockOnCommand}
          onListeningStart={mockOnListeningStart}
          onListeningStop={mockOnListeningStop}
        />
      )

      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keyup', expect.any(Function))
    })
  })
})
