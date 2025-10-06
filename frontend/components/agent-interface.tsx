"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Send, Bot, Sparkles, User, Mic, MessageSquare, Activity } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { startChatSession, sendChatMessage } from "@/lib/chatbot-api";
import { supabase } from "@/lib/supabase";
import { useCredits } from "@/hooks/use-credits"
import { useAuth } from "@/lib/auth-context"
import Orb from "./Orb";
import OrbIcon from "./orb-icon";
import { useDeepgramTTS } from "@/hooks/use-deepgram-tts";
import { VoiceModelPicker } from "@/components/voice-model-picker";

interface AgentInterfaceProps {
  companyId: string;
  onComplete?: () => void;
}

type AgentMode = "voice" | "chat";

export function AgentInterface({ companyId, onComplete }: AgentInterfaceProps) {
  const [agentMode, setAgentMode] = useState<AgentMode>("voice");
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      type: "user" | "agent";
      text: string;
      timestamp: Date;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const { t } = useLanguage();
  const { hasEnoughCredits, getRequiredCredits } = useCredits()
  const { user } = useAuth()

  // Set up TTS stream WS for this session when available
  const userIdRef = useRef<string | null>(null)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null
    })()
  }, [])

  // Initialize chat session when switching to chat mode
  useEffect(() => {
    if (agentMode === "chat" && !chatSessionId) {
      initializeChatSession();
    }
  }, [agentMode]);

  // Scroll to bottom of chat when new messages are added
  useEffect(() => {
    if (chatContainerRef.current && agentMode === "chat") {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, agentMode]);

  const initializeChatSession = async () => {
    try {
      setError(null);
      const sessionId = await startChatSession(companyId);
      setChatSessionId(sessionId);
    } catch (error) {
      console.error("Error initializing chat session:", error);
      setError("Error al inicializar la sesión de chat");
    }
  };

  const handleModeChange = (newMode: AgentMode) => {
    setAgentMode(newMode);
    setError(null);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const message = chatMessage.trim();
    if (!message || !chatSessionId || isSendingMessage) {
      return;
    }

    try {
      setIsSendingMessage(true);
      setError(null);

      // Add user message to conversation
      const userMessage = {
        type: "user" as const,
        text: message,
        timestamp: new Date(),
      };
      setConversationHistory((prev) => [...prev, userMessage]);
      setChatMessage("");

      console.log("Sending chat message:", message);
      const response = await sendChatMessage(chatSessionId, message);
      console.log("Received chat response:", response);

      // Add agent response to conversation
      const agentMessage = {
        type: "agent" as const,
        text: response.text,
        timestamp: new Date(),
      };
      setConversationHistory((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error("Chat message error:", error);
      setError(error instanceof Error ? error.message : "Error al procesar el mensaje de chat");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const clearConversation = () => {
    setConversationHistory([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border border-purple-100/70 bg-white/70 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-purple-50 opacity-70" />
        <div className="relative z-10 flex items-center justify-between p-4 md:p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <OrbIcon className="h-3.5 w-3.5" />
              <span>Studio de tu Agente</span>
            </div>
            <h3 className="mt-2 text-lg font-semibold md:text-xl">{`Habla con tu agente`}</h3>
            <p className="text-xs text-muted-foreground md:text-sm">{`Cambia entre chat y voz. Diseñado para claridad, velocidad y enfoque.`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 bg-white/70 backdrop-blur">
              <Activity className="h-3.5 w-3.5 text-purple-600" />
              <span>Live</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <Card className="border-purple-100/70 bg-white/70 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-50">
                <OrbIcon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{t('dashboard.sideMenu.myAgent')}</span>
            </div>
            <div className="w-full sm:w-auto">
              <div className="grid w-full grid-cols-2 overflow-hidden rounded-lg bg-purple-50 text-purple-700">
                <button
                  type="button"
                  onClick={() => handleModeChange("chat")}
                  className={`px-3 py-1.5 text-sm transition-colors data-[active=true]:bg-white data-[active=true]:text-purple-700 ${agentMode === "chat" ? "data-[active=true]:bg-white" : ""}`}
                  data-active={agentMode === "chat"}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("voice")}
                  className={`px-3 py-1.5 text-sm transition-colors data-[active=true]:bg-white data-[active=true]:text-purple-700 ${agentMode === "voice" ? "data-[active=true]:bg-white" : ""}`}
                  data-active={agentMode === "voice"}
                >
                  Voice
                </button>
              </div>
              <div className="sr-only" aria-live="polite">
                {agentMode === "chat" ? "Chat mode selected" : "Voice mode selected"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-800">
              <AlertCircle className="mr-2 h-5 w-5" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Mode */}
      {agentMode === "voice" && (
        <VoiceAgentContent companyId={companyId} />
      )}

      {/* Chat Mode */}
      {agentMode === "chat" && (
        <ChatContent
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          isSendingMessage={isSendingMessage}
          conversationHistory={conversationHistory}
          chatSessionId={chatSessionId}
          onChatSubmit={handleChatSubmit}
          onClearConversation={clearConversation}
          chatContainerRef={chatContainerRef}
        />
      )}
    </div>
  );
}

// Voice Agent Content Component
function VoiceAgentContent({ companyId }: { companyId: string }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [orbTheme, setOrbTheme] = useState<{ hue: number; intensity: number; accent: string }>({ hue: 260, intensity: 0.35, accent: '#7c3aed' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready');
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsModel, setTtsModel] = useState<string | undefined>(undefined)

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionIdRef = useRef<string>('');
  const readyForAudioRef = useRef<boolean>(false);
  const startedMicRef = useRef<boolean>(false);
  const readinessTimerRef = useRef<number | null>(null);
  
  const { hasEnoughCredits, getRequiredCredits } = useCredits();

  // Setup TTS stream (guard if IDs are missing)
  const [ttsReady, setTtsReady] = useState(false)
  const userIdForTtsRef = useRef<string>("")
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userIdForTtsRef.current = user?.id ?? ""
      setTtsReady(true)
    })()
  }, [])

  const currentSessionIdForTts = (sessionIdRef.current || sessionId) as string
  const tts = useDeepgramTTS({
    companyId,
    userId: userIdForTtsRef.current,
    sessionId: currentSessionIdForTts || "",
    lang: 'es',
    model: ttsModel,
    wsBase: 'wss://ddc3eb9626a5.ngrok-free.app'
  })

  interface TranscriptionData {
    type: string;
    transcript?: string;
    is_final?: boolean;
    message?: string;
    session_id?: string;
    original_session_id?: string;
    ready_for_audio?: boolean;
  }

  const startRecording = async () => {
    try {
      const tStart = performance.now()
      // Check credits before starting voice session
      const requiredCredits = getRequiredCredits('voice_call', 1) // 1 minute minimum
      const hasCredits = hasEnoughCredits('voice_call', 1)
      
      console.log('🔍 VoiceAgent: Credit check:', {
        requiredCredits,
        hasCredits,
        service: 'voice_call'
      })
      
      if (!hasCredits) {
        setError("Insufficient credits for voice call. Please purchase credits to continue.")
        return
      }

      setError('');
      setStatus('Requesting microphone access...');
      const micT0 = performance.now()
      readyForAudioRef.current = false
      
      console.log('🧪 Voice Agent - Connecting WebSocket with original session ID: test');

      // Get user ID from auth
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "unknown-user";
      
      console.log('🧪 Voice Agent - Auth Debug:', {
        user: user,
        userId: userId,
        hasUser: !!user,
        userEmail: user?.email
      });

      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      console.log(`⏱️ Mic getUserMedia ms=${Math.round(performance.now() - micT0)}`)

      setStatus('Connecting to transcription service...');

      // Get company_id and user_id from your app state/context
      const companyIdParam = companyId; // From props
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/deepgram/websocket/test?company_id=${companyIdParam}&user_id=${userId}`;
      const wsOpenT0 = performance.now()
      
      console.log('🧪 Voice Agent - WebSocket URL with parameters:', {
        companyId: companyIdParam,
        userId: userId,
        companyIdType: typeof companyIdParam,
        userIdType: typeof userId,
        companyIdLength: companyIdParam?.length || 0,
        userIdLength: userId?.length || 0,
        fullUrl: wsUrl
      });
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setStatus('Connected - Waiting for session details...');
        console.log(`⏱️ WS open ms=${Math.round(performance.now() - wsOpenT0)}`)
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: TranscriptionData = JSON.parse(event.data);
          // Debug: log any status payloads verbatim
          if ((data as any).type === 'status') {
            console.log('🧪 Voice Agent - STATUS frame raw:', event.data)
          }

          // Initial session status with IDs
          if (data.type === 'status' && data.session_id && data.original_session_id) {
            console.log('🧪 Voice Agent - Status with session details:', data);
            setSessionId(data.session_id);
            sessionIdRef.current = data.session_id;
            setStatus('Connected - Waiting for audio readiness…');
            // Fallback: if backend never sends explicit ready_for_audio, start after 2.5s
            if (readinessTimerRef.current) window.clearTimeout(readinessTimerRef.current)
            readinessTimerRef.current = window.setTimeout(() => {
              if (!startedMicRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.warn('⚠️ No ready_for_audio received; starting mic after fallback timeout')
                readyForAudioRef.current = true
                startAudioStream()
              }
            }, 2500)
            return;
          }

          // Backend indicates Deepgram is ready to receive/send audio
          const messageStr = typeof data.message === 'string' ? data.message : ''
          const nestedReady = (data as any)?.data?.ready_for_audio === true || (data as any)?.ready_for_audio === true
          const messageReady = /ready_for_audio|ready for audio|deepgram.+open/i.test(messageStr || '')
          const statusReady = (data as any)?.status === 'ready_for_audio'
          if (data.type === 'status' && (nestedReady || messageReady || statusReady)) {
            console.log('🧪 Voice Agent - ready_for_audio received');
            readyForAudioRef.current = true;
            if (readinessTimerRef.current) { window.clearTimeout(readinessTimerRef.current); readinessTimerRef.current = null }
            const streamT0 = performance.now();
            startAudioStream();
            console.log(`⏱️ startAudioStream() scheduled ms=${Math.round(performance.now() - streamT0)}`)
            console.log(`⏱️ startRecording total ms=${Math.round(performance.now() - tStart)}`)
            return;
          }

          handleTranscription(data);
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      wsRef.current.onerror = (error) => {
        setStatus('Connection failed');
        setError('WebSocket connection failed');
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        setStatus('Disconnected');
        setIsRecording(false);
      };

    } catch (error) {
      setStatus('Error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Error starting recording: ${errorMessage}`);
      console.error('Error starting recording:', error);
    }
  };

  const handleTranscription = (data: TranscriptionData) => {
    if (data.type === 'transcript') {
      const isFinal = data.is_final || false;
      const transcriptText = data.transcript || '';
      
      if (transcriptText.trim()) {
        if (isFinal) {
          setTranscript(prev => prev + transcriptText + ' ');
          sendToAgent(transcriptText);
        } else {
          setTranscript(prev => {
            const lines = prev.split('\n');
            const finalLines = lines.filter(line => !line.includes('🔄'));
            return finalLines.join('\n') + '\n🔄 ' + transcriptText;
          });
        }
      }
    } else if (data.type === 'error') {
      setError(`Transcription error: ${data.message}`);
    } else if (data.type === 'status') {
      console.log('Status:', data.message);
    }
  };

  const sendToAgent = async (userText: string) => {
    const currentSessionId = sessionIdRef.current || sessionId;
    console.log('🧪 Voice Agent - Sending to agent:', { 
      userText, 
      sessionId: currentSessionId,
      sessionIdRef: sessionIdRef.current,
      sessionIdState: sessionId 
    });
    
    if (!currentSessionId) {
      console.error('No session ID available');
      return;
    }

    try {
      setIsProcessing(true);
      setStatus('Processing with AI agent...');

      const formData = new FormData();
      formData.append('session_id', currentSessionId);
      formData.append('user_text', userText);
      
      console.log('🧪 Voice Agent - Request payload:', {
        session_id: currentSessionId,
        user_text: userText
      });
      const t0 = performance.now()
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/agent/voice/text`, {
        method: 'POST',
        body: formData
      });
      console.log(`⏱️ /agent/voice/text fetch ms=${Math.round(performance.now() - t0)}`)

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🧪 Voice Agent - Backend error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const t1 = performance.now()
      const data = await response.json();
      console.log(`⏱️ /agent/voice/text parse ms=${Math.round(performance.now() - t1)}`)
      
      console.log('🧪 Voice Agent - Response received:', {
        hasAudioResponse: !!data.audio,
        audioLength: data.audio?.length || 0,
        hasTextResponse: !!data.textResponse,
        textResponse: data.textResponse,
        fullResponse: data
      });
      
      if (data.audio) {
        // Prefer streamed TTS; ignore base64 audio to avoid overlap
        console.log('🧪 Voice Agent - Ignoring base64 audio in favor of TTS stream');
      } else {
        console.log('🧪 Voice Agent - No audio response received');
      }

      if (data.textResponse) {
        setTranscript(prev => prev + '\nAI: ' + data.textResponse + '\n');
        if (ttsReady && userIdForTtsRef.current && (sessionIdRef.current || sessionId)) {
          try {
            // Ensure we only send plain text to TTS (never JSON)
            let ttsText = data.textResponse
            if (typeof ttsText !== 'string') {
              ttsText = String(ttsText)
            }
            const trimmed = ttsText.trim()
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                const parsed = JSON.parse(trimmed)
                if (parsed && typeof parsed === 'object') {
                  ttsText = parsed.text || parsed.textResponse || parsed.message || trimmed
                }
              } catch {
                // keep original string if JSON.parse fails
              }
            }
            console.log('[TTS] sending plain text', { len: ttsText.length, sample: ttsText.slice(0, 80) })
            const tt0 = performance.now()
            tts.speak(ttsText)
            tts.flush()
            console.log(`⏱️ TTS enqueue+flush ms=${Math.round(performance.now() - tt0)}`)
          } catch {}
        }
      }

    } catch (error) {
      console.error('Error sending to agent:', error);
      setError(`Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus('Error processing with agent');
    } finally {
      setIsProcessing(false);
    }
  };

  const startAudioStream = () => {
    if (!audioStreamRef.current || !wsRef.current) return;
    if (!readyForAudioRef.current) {
      console.log('🔒 Not starting mic: backend not ready_for_audio yet');
      return;
    }
    if (startedMicRef.current) {
      console.log('🔁 Mic already started - ignoring duplicate start');
      return;
    }

    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);

    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (event) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        wsRef.current.send(int16Data.buffer);
      }
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);

    setIsRecording(true);
    setStatus('Recording - Speak now!');
    startedMicRef.current = true
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus('Stopped');
    
    const currentSessionId = sessionIdRef.current || sessionId;
    if (currentSessionId) {
      console.log('🧪 Voice Agent - Session ended:', currentSessionId);
    }
    
    setSessionId('');
    sessionIdRef.current = '';
    readyForAudioRef.current = false
    startedMicRef.current = false
    if (readinessTimerRef.current) { window.clearTimeout(readinessTimerRef.current); readinessTimerRef.current = null }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    try { tts.close() } catch {}
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  useEffect(() => {
    return () => {
      stopRecording();
      try { tts.close() } catch {}
    };
  }, []);

  return (
    <div className="space-y-6">


      {/* Live Mode Controls */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="grid items-center gap-6 md:grid-cols-2">
            {/* Circular Mic with ripples */}
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-sm h-64 md:h-80 cursor-pointer">
                                 <Orb
                   hoverIntensity={isRecording ? 0.5 : (status.includes('Playing') ? orbTheme.intensity : 0.2)}
                   rotateOnHover={true}
                   hue={status.includes('Processing') ? 30 : (status.includes('Playing') ? orbTheme.hue : orbTheme.hue)}
                   forceHoverState={isRecording || status.includes('Playing')}
                 />
                {/* Overlay clickable label */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className="absolute inset-0 flex items-center justify-center focus:outline-none"
                  aria-label={isRecording ? 'Detener escucha' : 'Iniciar escucha'}
                  title={isRecording ? 'Tap para detener' : 'Tap para iniciar'}
                >
                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors backdrop-blur-sm border-2 shadow-sm ${
                      isRecording || isProcessing
                        ? 'bg-white/80 text-purple-700 border-purple-500'
                        : 'bg-white/80 text-purple-700 border-purple-500'
                    }`}
                  >
                    {isProcessing ? 'PROCESSING…' : isRecording ? 'LIVE • TAP TO STOP' : 'TAP TO START'}
                  </span>
                </button>
              </div>
              {/* Hidden fallback for a11y */}
              <button aria-hidden className="sr-only">Mic</button>
            </div>

            {/* Transcript panel */}
            <div className="flex min-h-[260px] flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`inline-flex h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-purple-600' : 'bg-gray-300'}`} />
                  <p className="text-sm font-medium">
                    {isRecording ? 'Listening...' : status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={clearTranscript}
                    size="sm"
                    className="border-2 border-purple-600 bg-white text-purple-600 hover:border-purple-700 hover:text-purple-700"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-purple-200 bg-white/80 p-3 backdrop-blur">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">Transcript</div>
                <div className="min-h-[130px] whitespace-pre-wrap text-[15px] leading-6 font-[Inter,ui-sans-serif,system-ui]">
                  {transcript ? (
                    transcript.split('\n').map((line, idx) => {
                      const isAI = /^(\s*(🤖|AI:|Agent:|Agente:))/i.test(line)
                      const isInterim = /^\s*🔄/.test(line)
                      return (
                        <div
                          key={idx}
                          className={[
                            isAI ? 'text-purple-700' : 'text-gray-900',
                            isInterim ? 'italic text-gray-500' : 'font-medium'
                          ].join(' ')}
                        >
                          {line}
                        </div>
                      )
                    })
                  ) : (
                    <span className="text-muted-foreground">Your conversation will appear here...</span>
                  )}
                </div>
                {isRecording && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-purple-700">
                    <span>listening…</span>
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-purple-600" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200 border">
          <CardContent className="p-4">
            <div className="flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Voice model picker (TTS) */}
      <div className="w-full sm:w-auto">
        {userIdForTtsRef.current && (
          <VoiceModelPicker companyId={companyId} userId={userIdForTtsRef.current} onChange={(m) => setTtsModel(m)} />
        )}
      </div>
      
    </div>
  );
}

// Chat Content Component
function ChatContent({
  chatMessage,
  setChatMessage,
  isSendingMessage,
  conversationHistory,
  chatSessionId,
  onChatSubmit,
  onClearConversation,
  chatContainerRef
}: {
  chatMessage: string;
  setChatMessage: (message: string) => void;
  isSendingMessage: boolean;
  conversationHistory: Array<{ type: "user" | "agent"; text: string; timestamp: Date }>;
  chatSessionId: string | null;
  onChatSubmit: (e: React.FormEvent) => void;
  onClearConversation: () => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-6">
      {/* Chat Messages */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-0">
          <div ref={chatContainerRef} className="h-96 overflow-y-auto p-6 space-y-4">
            {conversationHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-300" />
                <p>Start a conversation with your AI agent</p>
              </div>
            ) : (
              conversationHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 ${
                    message.type === "agent" ? "" : "flex-row-reverse space-x-reverse"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl ${message.type === "agent" ? "bg-purple-100" : "bg-blue-100"}`}
                  >
                    {message.type === "agent" ? (
                      <Bot className="h-4 w-4 text-purple-600" />
                    ) : (
                      <User className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className={`flex-1 ${message.type === "agent" ? "text-left" : "text-right"}`}>
                    <div
                      className={`inline-block max-w-xs lg:max-w-md xl:max-w-lg p-3 rounded-xl ${
                        message.type === "agent" ? "bg-gray-100 text-gray-800" : "bg-blue-500 text-white"
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
            {isSendingMessage && (
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-purple-100">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="inline-block bg-gray-100 text-gray-800 p-3 rounded-xl">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat Input */}
      <form onSubmit={onChatSubmit} className="flex space-x-2">
        <Input
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder={chatSessionId ? "Type your message here..." : "Initializing chat session..."}
          disabled={!chatSessionId || isSendingMessage}
          className="flex-1 bg-white/70 backdrop-blur-sm border-gray-200 rounded-xl"
        />
        <Button
          type="submit"
          disabled={!chatSessionId || !chatMessage.trim() || isSendingMessage}
          className="px-6 rounded-xl"
        >
          {isSendingMessage ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Clear Conversation Button */}
      {conversationHistory.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onClearConversation}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white/60 backdrop-blur-sm rounded-xl"
          >
            Clear Conversation
          </Button>
        </div>
      )}
    </div>
  );
} 