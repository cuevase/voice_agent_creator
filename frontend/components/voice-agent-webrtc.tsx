"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Settings, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Play,
  Pause,
  Send,
  MessageCircle,
  Bot,
  Sparkles,
  User,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { supabase } from "@/lib/supabase"
import { 
  startPCMCapture, 
  stopPCMCapture, 
  getAssemblyAIPCMConfig,
  int16ToBase64 
} from "@/lib/pcm-audio-utils"

interface VoiceAgentWebRTCProps {
  companyId: string
  onComplete?: () => void
}

type Status = "idle" | "connecting" | "listening" | "speaking" | "error"

export function VoiceAgentWebRTC({ companyId, onComplete }: VoiceAgentWebRTCProps) {
  const { t, language } = useLanguage()
  
  // Core state
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  // Audio state
  const [currentVolume, setCurrentVolume] = useState(0)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  
  // Live transcription state
  const [liveTranscript, setLiveTranscript] = useState("")
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [isStreamingReady, setIsStreamingReady] = useState(false)
  
  // Debug counters
  const audioChunksSentRef = useRef(0)
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      type: "user" | "agent"
      text: string
      timestamp: Date
    }>
  >([])
  
  // UI state
  const [showSettings, setShowSettings] = useState(false)
  
  // Refs
  const websocketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const processingRef = useRef(false)
  
  // WebSocket connection
  const connectWebSocket = useCallback(async () => {
    try {
      setStatus("connecting")
      setError(null)
      
      // Use a temporary session ID for connection, will be updated by WebSocket status message
      const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log('🆔 Using temporary session ID for connection:', tempSessionId)
      
      // Use environment variable or fallback to a configurable URL
      const wsBaseUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://1c97c3cb359d.ngrok-free.app'
      const wsUrl = `${wsBaseUrl}/voice/webrtc/${companyId}/${tempSessionId}?sample_rate=16000`
      
      console.log('🔗 WebSocket Connection Details:')
      console.log('  - Environment Variable:', process.env.NEXT_PUBLIC_API_BASE_URL || 'NOT SET')
      console.log('  - Base URL:', wsBaseUrl)
      console.log('  - Company ID:', companyId)
      console.log('  - Session ID:', tempSessionId)
      console.log('  - Full URL:', wsUrl)
      console.log('  - Sample Rate Param:', '16000')
      const ws = new WebSocket(wsUrl)
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.error("WebSocket connection timeout")
          ws.close()
          setError("Connection timeout. Please try again.")
          setStatus("error")
        }
      }, 10000) // 10 second timeoutpm 
      
      ws.onopen = async () => {
        console.log("✅ WebSocket connected successfully")
        console.log("  - Connection State:", ws.readyState)
        console.log("  - URL:", ws.url)
        clearTimeout(connectionTimeout)
        
        // Get user ID from auth
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id || companyId
        
        // Send caller_info immediately after connection to initialize Deepgram buffer
        ws.send(JSON.stringify({
          type: 'caller_info',
          user_id: userId,
          language: language || 'es' // Use current language from context
        }))
        
        setIsConnected(true)
        setStatus("connecting") // Wait for streaming_ready
      }
      
      ws.onmessage = (event) => {
        console.log('📨 Received WebSocket message:', event.data)
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error)
        }
      }
      
      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error)
        console.error("  - Connection State:", ws.readyState)
        console.error("  - URL:", ws.url)
        setError("Failed to connect to voice server. Please check your connection and try again.")
        setStatus("error")
      }
      
      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected")
        console.log("  - Close Code:", event.code)
        console.log("  - Close Reason:", event.reason)
        console.log("  - Was Clean:", event.wasClean)
        clearTimeout(connectionTimeout)
        setIsConnected(false)
        setStatus("idle")
      }
      
      websocketRef.current = ws
      
    } catch (error) {
      console.error("Error connecting WebSocket:", error)
      setError("Failed to connect")
      setStatus("error")
    }
  }, [companyId, sessionId])
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'status':
        if (data.session_id && data.original_session_id) {
          console.log('🧪 VoiceAgent - Received initial status with session details:', data);
          setSessionId(data.session_id);
          console.log('🆔 Updated session ID to:', data.session_id);
        }
        break
      case 'streaming_ready':
        console.log('✅ Real-time streaming ready')
        setIsStreamingReady(true)
        setStatus("idle") // Now ready to start sending audio
        break
      case 'interim_transcript':
        if (data.is_final) {
          // Complete sentence transcribed
          console.log('📝 Final transcript:', data.text)
          setCurrentTranscript(data.text)
          setLiveTranscript("") // Clear interim transcript
        } else {
          // Live transcription as user speaks
          console.log('🎤 Live transcript:', data.text)
          setLiveTranscript(data.text)
        }
        break
      case 'audio_response':
        console.log('🤖 AI Response:', data.text)
        console.log('📝 User said:', data.transcription)
        
        // Play AI audio response
        handleAudioResponse(data)
        
        // Show conversation with transcription
        addToConversation({
          user: data.transcription,
          ai: data.text,
          timestamp: new Date()
        })
        break
      case 'text_response':
        handleTextResponse(data)
        break
      case 'error':
        console.error('❌ Error:', data.message)
        setError(data.message || 'Unknown error')
        setStatus("error")
        break
      default:
        console.log("Unknown message type:", data.type)
    }
  }, [])
  
  // Handle audio response from server
  const handleAudioResponse = useCallback(async (data: any) => {
    try {
      setStatus("speaking")
      
      // Stop any current audio
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
      }
      
      // Convert base64 to audio and play
      const audioBlob = await fetch(`data:audio/wav;base64,${data.audio}`).then(r => r.blob())
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        setStatus("idle")
        URL.revokeObjectURL(audioUrl)
      }
      
      audio.onerror = () => {
        setError("Failed to play audio response")
        setStatus("error")
        URL.revokeObjectURL(audioUrl)
      }
      
      setCurrentAudio(audio)
      await audio.play()
      
    } catch (error) {
      console.error("Error playing audio response:", error)
      setError("Failed to play audio")
      setStatus("error")
    }
  }, [currentAudio])
  
  // Handle text response from server
  const handleTextResponse = useCallback((data: any) => {
    setConversationHistory(prev => [...prev, {
      type: "agent",
      text: data.text,
      timestamp: new Date()
    }])
  }, [])
  
  // Add conversation entry with transcription
  const addToConversation = useCallback((entry: { user?: string, ai?: string, timestamp: Date }) => {
    if (entry.user) {
      setConversationHistory(prev => [...prev, {
        type: "user",
        text: entry.user!,
        timestamp: entry.timestamp
      }])
    }
    if (entry.ai) {
      setConversationHistory(prev => [...prev, {
        type: "agent", 
        text: entry.ai!,
        timestamp: entry.timestamp
      }])
    }
  }, [])
  
  // Get microphone access and start recording with PCM
  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting PCM recording process...')
      
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        console.error('❌ WebSocket not connected. State:', websocketRef.current?.readyState)
        setError("WebSocket not connected")
        return
      }
      
      console.log('✅ WebSocket is connected, starting PCM capture...')
      
      // Get PCM configuration optimized for AssemblyAI
      const pcmConfig = getAssemblyAIPCMConfig()
      console.log('🎯 PCM config:', pcmConfig)
      
      // Start PCM capture
      const { audioContext, processor, stream } = await startPCMCapture(
        (pcmData: Int16Array) => {
          console.log('📦 PCM data available:', {
            samples: pcmData.length,
            websocketState: websocketRef.current?.readyState
          })
          
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            console.log('🔄 Converting PCM to base64...')
            
            // Convert PCM to base64
            const base64PCM = int16ToBase64(pcmData)
            
            audioChunksSentRef.current += 1
            console.log('📤 Sending PCM chunk:', {
              type: 'audio',
              samples: pcmData.length,
              dataLength: base64PCM.length,
              websocketState: websocketRef.current?.readyState,
              totalChunksSent: audioChunksSentRef.current
            })
            
            const audioMessage = JSON.stringify({
              type: 'audio',
              audio: base64PCM
            })
            
            console.log('📤 Sending PCM chunk to server:', {
              messageLength: audioMessage.length,
              dataLength: base64PCM.length,
              websocketState: websocketRef.current?.readyState,
              websocketURL: websocketRef.current?.url,
              messageType: 'audio'
            })
            
            try {
              console.log('📡 Sending message to WebSocket:', {
                type: 'audio',
                dataLength: base64PCM.length,
                firstChars: base64PCM.substring(0, 20) + '...',
                lastChars: '...' + base64PCM.substring(base64PCM.length - 20)
              })
              websocketRef.current?.send(audioMessage)
              console.log('✅ PCM chunk sent successfully')
            } catch (error) {
              console.error('❌ Error sending PCM chunk:', error)
            }
          } else {
            console.warn('⚠️ Skipping PCM chunk - WebSocket not open')
          }
        },
        pcmConfig
      )
      
      // Store references
      audioContextRef.current = audioContext
      processorRef.current = processor
      streamRef.current = stream
      
      console.log('✅ PCM recording started successfully')
      setStatus("listening")
      
    } catch (error) {
      console.error("❌ Error starting PCM recording:", error)
      setError("Failed to access microphone")
      setStatus("error")
    }
  }, [])
  
  // Stop recording
  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping PCM recording...')
    
    if (audioContextRef.current && processorRef.current && streamRef.current) {
      console.log('🛑 Stopping PCM capture...')
      stopPCMCapture(audioContextRef.current, processorRef.current, streamRef.current)
      
      // Clear references
      audioContextRef.current = null
      processorRef.current = null
      streamRef.current = null
    } else {
      console.log('⚠️ PCM capture not active or already stopped')
    }
    
    console.log('✅ PCM recording stopped')
    setStatus("idle")
  }, [])
  
  // Start voice session
  const startVoiceSession = useCallback(async () => {
    console.log('🎯 Starting voice session...', {
      isConnected,
      isStreamingReady,
      status
    })
    
    // Clear previous transcripts
    setLiveTranscript("")
    setCurrentTranscript("")
    
    if (!isConnected) {
      console.log('🔌 Not connected, connecting WebSocket...')
      await connectWebSocket()
    }
    
    if (isStreamingReady) {
      console.log('✅ Streaming ready, starting recording...')
      await startRecording()
    } else {
      console.warn('⚠️ Streaming not ready yet, cannot start recording')
    }
  }, [isConnected, isStreamingReady, connectWebSocket, startRecording])
  
  // Stop voice session
  const stopVoiceSession = useCallback(() => {
    console.log('🛑 Stopping voice session...')
    stopRecording()
    
    if (websocketRef.current) {
      console.log('🔌 Closing WebSocket connection...')
      websocketRef.current.close()
      websocketRef.current = null
    }
    
    setIsConnected(false)
    setStatus("idle")
    console.log('✅ Voice session stopped')
  }, [stopRecording])
  
  // Handle retry
  const handleRetry = useCallback(async () => {
    setError(null)
    await startVoiceSession()
  }, [startVoiceSession])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      stopVoiceSession()
    }
  }, [stopVoiceSession])
  
  // Get status text
  const getStatusText = () => {
    switch (status) {
      case "idle":
        return isStreamingReady ? "Click to start listening" : "Ready to connect"
      case "connecting":
        return isConnected ? "Initializing streaming..." : "Connecting..."
      case "listening":
        return "Listening... (speak now)"
      case "speaking":
        return "AI speaking..."
      case "error":
        return "Error occurred"
      default:
        return "Unknown status"
    }
  }
  
  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case "idle":
        return "bg-gray-100 text-gray-800"
      case "connecting":
        return "bg-blue-100 text-blue-800"
      case "listening":
        return "bg-green-100 text-green-800"
      case "speaking":
        return "bg-purple-100 text-purple-800"
      case "error":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }
  
  // Check if WebRTC is supported
  const isWebRTCSupported = typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    !!navigator.mediaDevices.getUserMedia && 
    typeof MediaRecorder !== 'undefined'
  
  // Check if button is disabled
  const isButtonDisabled = () => {
    const disabled = status === "connecting" || status === "speaking" || processingRef.current
    console.log('🔘 Button disabled check:', {
      status,
      isConnecting: status === "connecting",
      isSpeaking: status === "speaking",
      isProcessing: processingRef.current,
      disabled,
      isWebRTCSupported
    })
    return disabled
  }
  
  return (
    <div className="space-y-6">
      {/* Main Voice Agent Card */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b border-blue-100/50 pb-6">
          <CardTitle className="flex items-center gap-3 text-gray-900">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Voice Agent (WebRTC)</h3>
              <p className="text-sm text-gray-500 font-normal">Real-time voice conversation with AI</p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Status Display */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Badge className={getStatusColor()}>
                {getStatusText()}
              </Badge>
              {isConnected && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              )}
              {isStreamingReady && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Streaming Ready
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Instructions */}
          {status === "idle" && isStreamingReady && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                💡 Click the microphone button to start real-time conversation with live transcription
              </p>
            </div>
          )}
          
          {/* WebRTC Support Check */}
          {!isWebRTCSupported && (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                WebRTC is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Safari.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {/* Main Controls */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Button
              onClick={() => {
                console.log('🔘 Microphone button clicked!', {
                  currentStatus: status,
                  isListening: status === "listening",
                  isSpeaking: status === "speaking",
                  isStreamingReady,
                  isConnected
                })
                
                if (status === "listening" || status === "speaking") {
                  stopVoiceSession()
                } else {
                  startVoiceSession()
                }
              }}
              disabled={isButtonDisabled() || !isWebRTCSupported}
              className={`h-16 w-16 rounded-full ${
                status === "listening" || status === "speaking"
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } ${status === "listening" ? 'animate-pulse' : ''}`}
            >
              {isButtonDisabled() ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : status === "listening" || status === "speaking" ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
            
            {error && (
              <Button
                onClick={handleRetry}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
          
          {/* Live Transcription Display */}
          <div className="live-transcription mb-4">
            {/* Show live transcription while speaking */}
            {liveTranscript && (
              <div className="interim-transcript p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <span className="speaking-indicator text-blue-600 text-sm">🎤 </span>
                <span className="live-text text-gray-700">{liveTranscript}</span>
              </div>
            )}
            
            {/* Show final transcription */}
            {currentTranscript && (
              <div className="final-transcript p-3 bg-green-50 rounded-lg border-l-4 border-green-400 mt-2">
                <strong className="text-green-700">You said:</strong> <span className="text-gray-800">{currentTranscript}</span>
              </div>
            )}
          </div>
          
          {/* Volume Indicator */}
          {isVoiceActive && (
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Volume2 className="h-4 w-4 text-gray-500" />
              <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-100"
                  style={{ width: `${(currentVolume / 100) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">WebRTC Settings</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Session ID: {sessionId || 'Not set'}</div>
                <div>Connection: {isConnected ? 'Connected' : 'Disconnected'}</div>
                <div>Streaming: {isStreamingReady ? 'Ready' : 'Initializing'}</div>
                <div>Status: {status}</div>
                <div>Live Transcript: {liveTranscript || 'None'}</div>
                <div>Last Said: {currentTranscript || 'None'}</div>
                <div>Audio Chunks Sent: {audioChunksSentRef.current}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversation History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 ${
                    message.type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs p-3 rounded-lg ${
                      message.type === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      {message.type === "user" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                      <span className="text-xs opacity-75">
                        {message.type === "user" ? "You" : "AI"}
                      </span>
                    </div>
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 