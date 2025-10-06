"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

interface TranscriptionData {
  type: string;
  transcript?: string;
  is_final?: boolean;
  message?: string;
  session_id?: string;
  original_session_id?: string;
}

interface VoiceAgentProps {
  companyId: string;
  onComplete?: () => void;
}

export function VoiceAgent({ companyId, onComplete }: VoiceAgentProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready');
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionIdRef = useRef<string>('');

  const { t } = useLanguage();

  const startRecording = async () => {
    try {
      setError('');
      setStatus('Requesting microphone access...');
      
      // The Deepgram WebSocket will create the session and return the session_id in the initial status message
      console.log('🧪 Voice Agent - Connecting WebSocket with original session ID: test');

      // Get microphone access
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
    }
      });

      setStatus('Connecting to transcription service...');

      // Connect to WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//localhost:8000/deepgram/websocket/test`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setStatus('Connected - Waiting for session details...');
        // No need to start audio stream immediately, wait for session_id from status message
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: TranscriptionData = JSON.parse(event.data);
          
          if (data.type === 'status' && data.session_id && data.original_session_id) {
            console.log('🧪 Voice Agent - Received initial status with session details:', data);
            setSessionId(data.session_id);
            sessionIdRef.current = data.session_id;
            setStatus('Connected - Session ready! Start speaking!');
            startAudioStream(); // Start audio stream only after session ID is confirmed
          } else {
            handleTranscription(data);
      }
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
          // For final results, append to transcript and send to agent
          setTranscript(prev => prev + transcriptText + ' ');
          
          // Send final text to agent
          sendToAgent(transcriptText);
        } else {
          // For interim results, show them but don't append yet
          setTranscript(prev => {
            // Remove any previous interim text and add new one
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
      
      const response = await fetch('http://localhost:8000/agent/voice/text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🧪 Voice Agent - Backend error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
  }

      const data = await response.json();
      
      console.log('🧪 Voice Agent - Response received:', {
        hasAudioResponse: !!data.audio,
        audioLength: data.audio?.length || 0,
        hasTextResponse: !!data.textResponse,
        textResponse: data.textResponse,
        fullResponse: data
      });
      
      if (data.audio) {
        console.log('🧪 Voice Agent - Playing audio response...');
        // Play the audio response
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        
        audio.onloadstart = () => console.log('🧪 Voice Agent - Audio loading started');
        audio.oncanplay = () => console.log('🧪 Voice Agent - Audio can play');
        audio.onplay = () => console.log('🧪 Voice Agent - Audio started playing');
        audio.onerror = (e) => console.error('🧪 Voice Agent - Audio error:', e);
        
        audio.play().catch(error => {
          console.error('🧪 Voice Agent - Failed to play audio:', error);
        });
        
        setStatus('Playing AI response...');
      } else {
        console.log('🧪 Voice Agent - No audio response received');
      }

      // Add AI response to transcript
      if (data.textResponse) {
        setTranscript(prev => prev + '\n🤖 AI: ' + data.textResponse + '\n');
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

    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);

    // Create a script processor to get raw audio data
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (event) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert float32 to int16
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Send audio data to WebSocket
        wsRef.current.send(int16Data.buffer);
      }
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);

    setIsRecording(true);
    setStatus('Recording - Speak now!');
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus('Stopped');
    
    // Clear session data
    const currentSessionId = sessionIdRef.current || sessionId;
    if (currentSessionId) {
      console.log('🧪 Voice Agent - Session ended:', currentSessionId);
    }
    
    setSessionId('');
    sessionIdRef.current = '';

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
  };

  const clearTranscript = () => {
    setTranscript('');
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="space-y-6">
          {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">🎤 Voice Agent - Live Mode</h3>
          <p className="text-gray-600">Real-time conversation with AI using new architecture</p>
              </div>
            </div>
            
      {/* Status Card */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-4">
          <div className={`flex items-center justify-center p-3 rounded-lg ${
            status.includes('Recording') ? 'bg-green-50 border-2 border-green-200' : 
            status.includes('Processing') ? 'bg-yellow-50 border-2 border-yellow-200' :
            status.includes('Error') ? 'bg-red-50 border-2 border-red-200' : 
            'bg-gray-50 border-2 border-gray-200'
          }`}>
            <div className={`w-3 h-3 rounded-full mr-3 ${
              status.includes('Recording') ? 'bg-green-500 animate-pulse' : 
              status.includes('Processing') ? 'bg-yellow-500' :
              status.includes('Error') ? 'bg-red-500' : 
              'bg-gray-400'
            }`}></div>
            <span className={`font-semibold ${
              status.includes('Recording') ? 'text-green-800' : 
              status.includes('Processing') ? 'text-yellow-800' :
              status.includes('Error') ? 'text-red-800' : 
              'text-gray-600'
            }`}>
              {isRecording ? '🔴 LIVE - Speak now!' : status}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Live Mode Controls */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
                <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              size="lg"
              className={`relative overflow-hidden transition-all duration-300 ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/25' 
                  : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25'
              }`}
            >
              {isRecording ? (
                <>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  🔴 Live Mode
                </>
              ) : (
                '🎤 Start Live Mode'
              )}
            </Button>
            
                <Button
              onClick={clearTranscript}
                  variant="outline"
                  size="sm"
              className="text-gray-600 hover:text-gray-800"
                >
              🗑️ Clear Transcript
                </Button>
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

      {/* Transcript */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Conversation Transcript</h4>
            {sessionId && (
              <Badge variant="outline" className="text-xs">
                Session: {sessionId.substring(0, 8)}...
              </Badge>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
              {transcript || 'Your conversation will appear here...\n\n🔄 Interim results will show here as you speak...'}
            </pre>
          </div>
        </CardContent>
      </Card>
      
      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200 border">
        <CardContent className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">🎤</span>
              </div>
                    </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-900">Live Mode Instructions</h4>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="space-y-1">
                  <li>• Click "Start Live Mode" and allow microphone access</li>
                  <li>• Speak naturally - the AI will respond automatically</li>
                  <li>• Watch your conversation appear in real-time</li>
                  <li>• Click the button again to stop live mode</li>
                  <li>• Use "Clear Transcript" to reset the conversation</li>
                </ul>
                    </div>
                    </div>
                    </div>
                  </CardContent>
                </Card>
    </div>
  );
}
