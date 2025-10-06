// PCM Audio utilities for AssemblyAI streaming

export interface PCMAudioConfig {
  sampleRate: number
  channelCount: number
  bufferSize: number
}

// Default PCM configuration for AssemblyAI
export const DEFAULT_PCM_CONFIG: PCMAudioConfig = {
  sampleRate: 16000,
  channelCount: 1,
  bufferSize: 4096
}

// Convert Float32Array to Int16Array (PCM)
export const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    // Convert from [-1, 1] range to [-32768, 32767] range
    const sample = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = sample * 0x7fff
  }
  return int16Array
}

// Convert Int16Array to base64
export const int16ToBase64 = (int16Array: Int16Array): string => {
  const buffer = int16Array.buffer
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Create AudioContext with optimal settings
export const createAudioContext = (config: PCMAudioConfig = DEFAULT_PCM_CONFIG): AudioContext => {
  return new AudioContext({
    sampleRate: config.sampleRate,
    latencyHint: 'interactive'
  })
}

// Create PCM audio processor
export const createPCMProcessor = (
  audioContext: AudioContext,
  onPCMData: (pcmData: Int16Array) => void,
  config: PCMAudioConfig = DEFAULT_PCM_CONFIG
): ScriptProcessorNode => {
  const processor = audioContext.createScriptProcessor(
    config.bufferSize,
    config.channelCount, // input channels
    config.channelCount  // output channels
  )
  
  processor.onaudioprocess = (event) => {
    const inputBuffer = event.inputBuffer
    const inputData = inputBuffer.getChannelData(0) // Get first channel (mono)
    
    // Convert to PCM
    const pcmData = float32ToInt16(inputData)
    
    // Send PCM data
    onPCMData(pcmData)
  }
  
  return processor
}

// Start PCM audio capture
export const startPCMCapture = async (
  onPCMData: (pcmData: Int16Array) => void,
  config: PCMAudioConfig = DEFAULT_PCM_CONFIG
): Promise<{ audioContext: AudioContext; processor: ScriptProcessorNode; stream: MediaStream }> => {
  try {
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: config.sampleRate,
        channelCount: config.channelCount,
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    
    // Create audio context
    const audioContext = createAudioContext(config)
    
    // Create source from stream
    const source = audioContext.createMediaStreamSource(stream)
    
    // Create PCM processor
    const processor = createPCMProcessor(audioContext, onPCMData, config)
    
    // Connect the audio nodes
    source.connect(processor)
    processor.connect(audioContext.destination)
    
    // Resume audio context (required for Chrome)
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    
    return { audioContext, processor, stream }
    
  } catch (error) {
    console.error('Error starting PCM capture:', error)
    throw error
  }
}

// Stop PCM audio capture
export const stopPCMCapture = (
  audioContext: AudioContext,
  processor: ScriptProcessorNode,
  stream: MediaStream
): void => {
  try {
    // Disconnect and stop processor
    processor.disconnect()
    processor.onaudioprocess = null
    
    // Stop all tracks
    stream.getTracks().forEach(track => {
      track.stop()
    })
    
    // Close audio context
    if (audioContext.state !== 'closed') {
      audioContext.close()
    }
    
  } catch (error) {
    console.error('Error stopping PCM capture:', error)
  }
}

// Calculate optimal buffer size for 50ms chunks
export const calculateOptimalBufferSize = (sampleRate: number = 16000): number => {
  // For 50ms chunks at 16kHz: 16000 * 0.05 = 800 samples
  const samplesPerChunk = Math.floor(sampleRate * 0.05)
  
  // Find the closest power of 2 that can hold our samples
  // ScriptProcessor requires buffer size to be power of 2
  let bufferSize = 256
  while (bufferSize < samplesPerChunk) {
    bufferSize *= 2
  }
  
  return bufferSize
}

// Get PCM configuration optimized for AssemblyAI
export const getAssemblyAIPCMConfig = (): PCMAudioConfig => {
  return {
    sampleRate: 16000,
    channelCount: 1,
    bufferSize: calculateOptimalBufferSize(16000)
  }
} 