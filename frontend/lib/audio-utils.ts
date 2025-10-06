export type MicPermissionStatus = "granted" | "denied" | "prompt"

export const checkMicrophonePermission = async (): Promise<MicPermissionStatus> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("MediaDevices not supported")
    }

    const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
    return result.state as MicPermissionStatus
  } catch (error) {
    // Fallback: try to access microphone directly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return "granted"
    } catch {
      return "denied"
    }
  }
}

export const playAudioFromBase64 = (base64Audio: string): Promise<HTMLAudioElement> => {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`)

      audio.onloadeddata = () => resolve(audio)
      audio.onerror = () => reject(new Error("Failed to load audio"))

      audio.play().catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

export class LiveConversationRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private dataArray: Uint8Array | null = null
  private stream: MediaStream | null = null

  private silenceThreshold = 25
  private silenceTimeout = 1500 // Shorter timeout for live conversation
  private minRecordingTime = 500 // Minimum recording time to avoid very short clips
  private maxRecordingTime = 10000 // Maximum recording time before auto-send

  private silenceTimer: NodeJS.Timeout | null = null
  private recordingTimer: NodeJS.Timeout | null = null
  private minTimeTimer: NodeJS.Timeout | null = null
  private isListening = false
  private isRecording = false
  private isInterruptionMode = false
  private chunks: Blob[] = []
  private recordingStartTime = 0
  private hasSpokenRecently = false

  public onAudioReady: ((audioBlob: Blob) => void) | null = null
  public onVoiceActivityChange: ((volume: number, isActive: boolean, isRecording: boolean) => void) | null = null
  public onError: ((error: Error) => void) | null = null
  public onStatusChange: ((status: "listening" | "recording" | "processing") => void) | null = null
  public onInterruptionDetected: (() => void) | null = null

  constructor() {
    this.handleDataAvailable = this.handleDataAvailable.bind(this)
    this.handleStop = this.handleStop.bind(this)
    this.analyzeAudio = this.analyzeAudio.bind(this)
  }

  setSilenceThreshold(threshold: number) {
    this.silenceThreshold = threshold
  }

  setSilenceTimeout(timeout: number) {
    this.silenceTimeout = timeout
  }

  setMinRecordingTime(time: number) {
    this.minRecordingTime = time
  }

  setMaxRecordingTime(time: number) {
    this.maxRecordingTime = time
  }

  async startLiveConversation(): Promise<void> {
    try {
      if (this.isListening) return

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimize for speech
        },
      })

      // Set up audio analysis
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.3
      this.microphone = this.audioContext.createMediaStreamSource(this.stream)
      this.microphone.connect(this.analyser)
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

      this.isListening = true
      this.onStatusChange?.("listening")

      // Start continuous audio analysis
      this.analyzeAudio()

      console.log("Live conversation mode started")
    } catch (error) {
      this.onError?.(error as Error)
      throw error
    }
  }

  stopLiveConversation(): void {
    if (!this.isListening) return

    this.isListening = false
    this.stopCurrentRecording()
    this.cleanup()
    console.log("Live conversation mode stopped")
  }

  pauseRecording(): void {
    if (this.isRecording) {
      console.log("🎤 Pausing recording")
      this.stopCurrentRecording()
    }
    // Temporarily disable voice activity detection
    this.isListening = false
  }

  resumeRecording(): void {
    if (!this.isListening) {
      console.log("🎤 Resuming recording")
      this.isListening = true
      // Restart audio analysis
      this.analyzeAudio()
    }
  }

  enableInterruptionDetection(): void {
    console.log("🎤 Enabling interruption detection")
    console.log("   - Current volume threshold:", this.silenceThreshold)
    console.log("   - Will detect interruption when volume >", this.silenceThreshold)
    this.isListening = true
    this.isInterruptionMode = true
    // Restart audio analysis for interruption detection
    this.analyzeAudio()
  }

  isActive(): boolean {
    return this.isListening
  }

  private startRecording() {
    if (this.isRecording || !this.stream) return

    try {
      // Set up media recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      this.mediaRecorder.ondataavailable = this.handleDataAvailable
      this.mediaRecorder.onstop = this.handleStop

      this.chunks = []
      this.mediaRecorder.start()
      this.isRecording = true
      this.recordingStartTime = Date.now()
      this.hasSpokenRecently = false

      this.onStatusChange?.("recording")

      // Set minimum recording time
      this.minTimeTimer = setTimeout(() => {
        this.hasSpokenRecently = true
      }, this.minRecordingTime)

      // Set maximum recording time
      this.recordingTimer = setTimeout(() => {
        if (this.isRecording) {
          console.log("Max recording time reached, stopping...")
          this.stopCurrentRecording()
        }
      }, this.maxRecordingTime)

      console.log("Started recording")
    } catch (error) {
      this.onError?.(error as Error)
    }
  }

  private stopCurrentRecording() {
    if (!this.isRecording) return

    this.isRecording = false

    // Clear timers
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer)
      this.recordingTimer = null
    }
    if (this.minTimeTimer) {
      clearTimeout(this.minTimeTimer)
      this.minTimeTimer = null
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }

    this.onStatusChange?.("processing")
    console.log("Stopped recording")
  }

  private handleDataAvailable(event: BlobEvent) {
    if (event.data.size > 0) {
      this.chunks.push(event.data)
    }
  }

  private handleStop() {
    const recordingDuration = Date.now() - this.recordingStartTime

    // Only send audio if it meets minimum requirements
    if (this.chunks.length > 0 && recordingDuration >= this.minRecordingTime) {
      const audioBlob = new Blob(this.chunks, { type: "audio/wav" })
      console.log(`Sending audio: ${audioBlob.size} bytes, ${recordingDuration}ms duration`)
      this.onAudioReady?.(audioBlob)
    } else {
      console.log("Recording too short, discarding")
      this.onStatusChange?.("listening")
    }

    this.chunks = []
  }

  private analyzeAudio() {
    if (!this.isListening || !this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray)

    // Calculate average volume with focus on speech frequencies
    const speechRange = this.dataArray.slice(1, 40) // Focus on speech frequencies
    const average = speechRange.reduce((sum, value) => sum + value, 0) / speechRange.length
    const volume = Math.round(average)

    const isActive = volume > this.silenceThreshold
    this.onVoiceActivityChange?.(volume, isActive, this.isRecording)

    // Handle interruption detection
    if (this.isInterruptionMode && isActive) {
      console.log("🚨 INTERRUPTION DETECTED! User started speaking during AI speech")
      console.log("   - Volume:", volume, "Threshold:", this.silenceThreshold)
      console.log("   - Stopping AI and processing interruption")
      this.isInterruptionMode = false
      this.onInterruptionDetected?.()
      return
    } else if (this.isInterruptionMode) {
      // Debug: Show volume during interruption mode
      console.log("🎤 Interruption mode active - Volume:", volume, "Threshold:", this.silenceThreshold)
    }

    // Handle normal voice activity detection (only when not in interruption mode)
    if (!this.isInterruptionMode && isActive) {
      // Voice detected
      if (!this.isRecording) {
        this.startRecording()
      }

      // Clear silence timer if voice is detected
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }
    } else if (!this.isInterruptionMode) {
      // Silence detected (only when not in interruption mode)
      if (this.isRecording && !this.silenceTimer && this.hasSpokenRecently) {
        // Start silence timer only if we've been recording for minimum time
        this.silenceTimer = setTimeout(() => {
          if (this.isRecording) {
            console.log("Silence timeout reached, stopping recording...")
            this.stopCurrentRecording()
          }
        }, this.silenceTimeout)
      }
    }

    // Continue analysis
    if (this.isListening) {
      requestAnimationFrame(this.analyzeAudio)
    }
  }

  private cleanup() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer)
      this.recordingTimer = null
    }
    if (this.minTimeTimer) {
      clearTimeout(this.minTimeTimer)
      this.minTimeTimer = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.microphone = null
    this.dataArray = null
    this.mediaRecorder = null
    this.isRecording = false
  }

  destroy() {
    this.stopLiveConversation()
    this.cleanup()
  }
}


