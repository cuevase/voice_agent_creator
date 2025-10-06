# WebRTC Voice Agent Implementation

## Overview

This implementation provides real-time voice conversation capabilities using WebRTC and WebSocket streaming. The voice agent connects to a WebSocket server and streams audio in 100ms chunks for real-time AI responses.

## Features

### ✅ Implemented Features

1. **WebSocket Connection**
   - Real-time bidirectional communication
   - Automatic session management
   - Connection timeout handling (10 seconds)
   - Graceful error handling

2. **Audio Streaming**
   - 16kHz mono PCM audio format
   - 50ms audio chunks (optimal for AssemblyAI)
   - Base64 encoding for transmission
   - Raw PCM (pcm_s16le) for AssemblyAI compatibility

3. **WebRTC Implementation**
   - Microphone access with optimal settings
   - MediaRecorder for audio capture
   - Real-time audio streaming
   - Browser compatibility checks

4. **User Experience**
   - Connection status indicators
   - Error messages and retry functionality
   - Conversation history display
   - Settings panel with debug info

## Configuration

### Environment Variables

Create a `.env.local` file with:

```bash
# WebSocket server URL
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-server.com
```

### WebSocket Endpoint

The voice agent connects to:
```
wss://your-server.com/voice/webrtc/{company_id}/{session_id}
```

## Message Format

### Sending Audio Chunks
```javascript
{
  type: 'audio_chunk',
  data: 'base64AudioData' // 50ms chunks of 16kHz mono audio
}
```

### Receiving Responses
```javascript
{
  type: 'audio_response',
  text: 'AI response text',
  audio: 'base64AudioData'
}
```

## Browser Support

The implementation checks for:
- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder` API
- WebSocket support

## Error Handling

- **Connection timeout**: 10-second timeout for WebSocket connections
- **Microphone access**: Clear error messages for permission issues
- **Audio playback**: Graceful handling of audio response errors
- **WebRTC support**: Fallback message for unsupported browsers

## Usage

1. **Start Voice Session**: Click the microphone button to connect and start recording
2. **Real-time Conversation**: Speak naturally - audio is streamed in real-time
3. **AI Responses**: Listen to AI responses played automatically
4. **Conversation History**: View the conversation history below the controls
5. **Settings**: Click the settings icon to view connection details

## Technical Details

### AssemblyAI Audio Requirements
The implementation is optimized for AssemblyAI Live streaming with the following specifications:

- **Encoding**: 16-bit PCM (pcm_s16le) - Raw PCM data
- **Sample Rate**: 16kHz (typical mic/browser capture)
- **Channels**: Mono (single channel)
- **Chunk Duration**: 50ms for lowest latency
- **WebSocket URL**: Includes `sample_rate=16000` parameter
- **Audio Capture**: Web Audio API with ScriptProcessor for raw PCM

### Audio Configuration
```typescript
const audioConfig = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true
}
```

### PCM Audio Setup
```typescript
// Start PCM capture with Web Audio API
const { audioContext, processor, stream } = await startPCMCapture(
  (pcmData: Int16Array) => {
    // Convert PCM to base64 and send
    const base64PCM = int16ToBase64(pcmData)
    websocket.send(JSON.stringify({
      type: 'audio_chunk',
      data: base64PCM
    }))
  },
  getAssemblyAIPCMConfig()
)
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the WebSocket server is running
   - Verify the `NEXT_PUBLIC_WEBSOCKET_URL` environment variable
   - Check browser console for detailed error messages

2. **Microphone Access Denied**
   - Ensure microphone permissions are granted
   - Check browser settings for microphone access
   - Try refreshing the page and granting permissions again

3. **Audio Not Playing**
   - Check if audio is enabled in the browser
   - Verify the audio response format from the server
   - Check browser console for audio-related errors

4. **WebRTC Not Supported**
   - Use a modern browser (Chrome, Firefox, Safari)
   - Ensure HTTPS is used (required for getUserMedia)
   - Check if the browser supports MediaRecorder API

### Debug Information

The settings panel shows:
- Session ID
- Connection status
- Current status
- Error details (if any)

## Future Enhancements

- [ ] Voice activity detection
- [ ] Audio level visualization
- [ ] Multiple audio codec support
- [ ] Connection quality monitoring
- [ ] Automatic reconnection
- [ ] Audio recording/download
- [ ] Custom audio settings 