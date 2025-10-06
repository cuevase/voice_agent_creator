import React, { useState, useRef, useEffect } from 'react';

const DeepgramVoiceComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [audioInfo, setAudioInfo] = useState({
    status: 'Stopped',
    sampleRate: '-',
    channels: '-',
    bytesSent: 0
  });

  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioStreamRef = useRef(null);
  const processorRef = useRef(null);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/deepgram/websocket/test`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setError('');
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleTranscription(data);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    wsRef.current.onerror = (error) => {
      setIsConnected(false);
      setError('WebSocket connection failed');
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setIsRecording(false);
      console.log('WebSocket disconnected');
    };
  };

  const handleTranscription = (data) => {
    if (data.type === 'transcript') {
      const isFinal = data.is_final || false;
      const transcriptText = data.transcript || '';
      
      if (transcriptText.trim()) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = isFinal ? '✅ FINAL' : '🔄 INTERIM';
        const entry = `[${timestamp}] ${prefix}: ${transcriptText}\n`;
        
        setTranscript(prev => prev + entry);
      }
    } else if (data.type === 'error') {
      setError(`Transcription error: ${data.message}`);
    } else if (data.type === 'status') {
      console.log('Status:', data.message);
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      
      // Get microphone access
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Connect to WebSocket
      connectWebSocket();

      // Wait for WebSocket to connect
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        
        if (wsRef.current) {
          wsRef.current.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
        }
      });

      // Start audio processing
      startAudioStream();

    } catch (error) {
      setError(`Error starting recording: ${error.message}`);
      console.error('Error starting recording:', error);
    }
  };

  const startAudioStream = () => {
    if (!audioStreamRef.current || !wsRef.current) return;

    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);

    // Create a script processor to get raw audio data
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    let bytesSent = 0;

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
        bytesSent += int16Data.buffer.byteLength;
        
        setAudioInfo({
          status: 'Streaming',
          sampleRate: 16000,
          channels: 1,
          bytesSent: bytesSent
        });
      }
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);

    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);

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

    setIsConnected(false);
    setAudioInfo({
      status: 'Stopped',
      sampleRate: '-',
      channels: '-',
      bytesSent: 0
    });
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1>🎤 Deepgram Voice Test</h1>
        <p>Test real-time speech-to-text with Deepgram via WebSocket</p>
        
        {/* Status */}
        <div style={{
          padding: '10px',
          margin: '10px 0',
          borderRadius: '5px',
          fontWeight: 'bold',
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          color: isConnected ? '#155724' : '#721c24'
        }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        
        {/* Controls */}
        <div style={{ margin: '20px 0' }}>
          <button
            onClick={startRecording}
            disabled={isRecording}
            style={{
              padding: '12px 24px',
              margin: '5px',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecording ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              backgroundColor: isRecording ? '#6c757d' : '#28a745',
              color: 'white'
            }}
          >
            🎤 Start Recording
          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            style={{
              padding: '12px 24px',
              margin: '5px',
              border: 'none',
              borderRadius: '5px',
              cursor: !isRecording ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              backgroundColor: !isRecording ? '#6c757d' : '#dc3545',
              color: 'white'
            }}
          >
            ⏹️ Stop Recording
          </button>
        </div>
        
        {/* Audio Info */}
        {audioInfo.status !== 'Stopped' && (
          <div style={{
            backgroundColor: '#e9ecef',
            padding: '10px',
            borderRadius: '5px',
            margin: '10px 0',
            fontSize: '14px'
          }}>
            <strong>Audio Status:</strong> {audioInfo.status}<br />
            <strong>Sample Rate:</strong> {audioInfo.sampleRate} Hz<br />
            <strong>Channels:</strong> {audioInfo.channels}<br />
            <strong>Bytes Sent:</strong> {audioInfo.bytesSent.toLocaleString()}
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '5px',
            margin: '10px 0'
          }}>
            {error}
          </div>
        )}
        
        {/* Transcript */}
        <h3>📝 Live Transcript</h3>
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '5px',
          padding: '15px',
          margin: '20px 0',
          minHeight: '200px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          overflowY: 'auto',
          maxHeight: '400px'
        }}>
          {transcript || 'Waiting for audio...'}
        </div>
      </div>
    </div>
  );
};

export default DeepgramVoiceComponent; 