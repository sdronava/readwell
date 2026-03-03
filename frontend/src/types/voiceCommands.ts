export type VoiceCommandType =
  | 'play'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'faster'
  | 'slower'
  | 'speed_normal'
  | 'next_page'
  | 'previous_page'
  | 'goto_page'

export interface VoiceCommand {
  type: VoiceCommandType
  confidence: number
  transcript: string
  pageNumber?: number // For 'goto_page' command
}
