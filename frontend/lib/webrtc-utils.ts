// WebRTC utility functions for voice agent

export interface WebRTCAudioConfig {
  sampleRate: number
  channelCount: number
  echoCancellation: boolean
  noiseSuppression: boolean
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'audio_response' | 'text_response' | 'error'
  data?: string
  text?: string
  audio?: string
  message?: string
}

// Default audio configuration for WebRTC (optimized for AssemblyAI)
export const DEFAULT_AUDIO_CONFIG: WebRTCAudioConfig = {
  sampleRate: 16000, // 16kHz for typical mic/browser capture
  channelCount: 1,    // Mono channel
  echoCancellation: true,
  noiseSuppression: true
}

// Get microphone access with specified configuration
export const getMicrophoneAccess = async (config: WebRTCAudioConfig = DEFAULT_AUDIO_CONFIG): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: config.sampleRate,
        channelCount: config.channelCount,
        echoCancellation: config.echoCancellation,
        noiseSuppression: config.noiseSuppression
      }
    })
    return stream
  } catch (error) {
    console.error('Error accessing microphone:', error)
    throw new Error('Failed to access microphone. Please check permissions.')
  }
}

// Create MediaRecorder with optimal settings for AssemblyAI
export const createMediaRecorder = (stream: MediaStream): MediaRecorder => {
  const options = {
    mimeType: 'audio/webm; codecs=opus',
    audioBitsPerSecond: 16000
  }
  
  return new MediaRecorder(stream, options)
}

// Get optimal chunk duration for AssemblyAI (50ms for lowest latency)
export const getOptimalChunkDuration = (): number => {
  return 50 // 50ms chunks for lowest latency
}

// Convert audio blob to base64
export const audioBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64Data = result.split(',')[1] // Remove data: prefix
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Convert base64 audio to blob
export const base64ToAudioBlob = async (base64Data: string, mimeType: string = 'audio/wav'): Promise<Blob> => {
  const response = await fetch(`data:${mimeType};base64,${base64Data}`)
  return response.blob()
}

// Play audio from base64 data
export const playAudioFromBase64 = async (base64Data: string, mimeType: string = 'audio/wav'): Promise<HTMLAudioElement> => {
  const blob = await base64ToAudioBlob(base64Data, mimeType)
  const audioUrl = URL.createObjectURL(blob)
  const audio = new Audio(audioUrl)
  
  return new Promise((resolve, reject) => {
    audio.oncanplaythrough = () => resolve(audio)
    audio.onerror = reject
    audio.load()
  })
}

// Create WebSocket connection
export const createWebSocketConnection = (
  companyId: string, 
  sessionId: string, 
  onMessage: (data: WebSocketMessage) => void,
  onError: (error: string) => void,
  onClose: () => void
): WebSocket => {
  const wsUrl = `wss://1c97c3cb359d.ngrok-free.app/voice/webrtc/${companyId}/${sessionId}`
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => {
    console.log('WebSocket connected')
  }
  
  ws.onmessage = (event) => {
    try {
      const data: WebSocketMessage = JSON.parse(event.data)
      onMessage(data)
    } catch (error) {
      console.error('Error parsing WebSocket message:', error)
      onError('Failed to parse server message')
    }
  }
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    onError('Connection error')
  }
  
  ws.onclose = () => {
    console.log('WebSocket disconnected')
    onClose()
  }
  
  return ws
}

// Send audio chunk via WebSocket
export const sendAudioChunk = (websocket: WebSocket, base64Audio: string): void => {
  if (websocket.readyState === WebSocket.OPEN) {
    const message: WebSocketMessage = {
      type: 'audio_chunk',
      data: base64Audio
    }
    websocket.send(JSON.stringify(message))
  } else {
    console.warn('WebSocket is not open, cannot send audio chunk')
  }
}

// Generate session ID
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Check if WebRTC is supported
export const isWebRTCSupported = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

// Check if MediaRecorder is supported
export const isMediaRecorderSupported = (): boolean => {
  return !!window.MediaRecorder
}

// Get supported MIME types for MediaRecorder
export const getSupportedMimeTypes = (): string[] => {
  const types = [
    'audio/webm; codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg; codecs=opus'
  ]
  
  return types.filter(type => MediaRecorder.isTypeSupported(type))
}

// Validate audio configuration
export const validateAudioConfig = (config: WebRTCAudioConfig): boolean => {
  return (
    config.sampleRate > 0 &&
    config.channelCount > 0 &&
    config.channelCount <= 2 &&
    typeof config.echoCancellation === 'boolean' &&
    typeof config.noiseSuppression === 'boolean'
  )
} 