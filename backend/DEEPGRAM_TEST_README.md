# 🎤 Deepgram WebSocket Test Setup

This setup allows you to test real-time speech-to-text transcription using Deepgram via WebSocket from both a simple HTML page and a React component.

## 🚀 Quick Start

### 1. Prerequisites
- Make sure you have a `DEEPGRAM_API_KEY` in your `.env` file
- The server should be running on `http://localhost:8000`

### 2. Test Options

#### Option A: Simple HTML Test Page
1. Open your browser and go to: `http://localhost:8000/test_deepgram_websocket`
2. Click "🎤 Start Recording" to begin
3. Speak into your microphone
4. Watch the real-time transcript appear
5. Click "⏹️ Stop Recording" when done

#### Option B: React Component
1. Copy the `DeepgramVoiceComponent.jsx` file to your React project
2. Import and use it in your React app:

```jsx
import DeepgramVoiceComponent from './DeepgramVoiceComponent';

function App() {
  return (
    <div>
      <h1>My Voice App</h1>
      <DeepgramVoiceComponent />
    </div>
  );
}
```

## 🔧 How It Works

### Frontend (Browser)
1. **Audio Capture**: Uses `navigator.mediaDevices.getUserMedia()` to access microphone
2. **Audio Processing**: Converts audio to 16kHz mono PCM format using Web Audio API
3. **WebSocket Streaming**: Sends raw audio data to backend via WebSocket
4. **Real-time Display**: Receives transcription results and displays them live

### Backend (Python/FastAPI)
1. **WebSocket Handler**: Receives audio data from frontend
2. **Deepgram Integration**: Streams audio to Deepgram's real-time API
3. **Transcription Processing**: Receives transcription results and sends them back to frontend
4. **Error Handling**: Manages connection issues and provides feedback

## 📁 Files Created

- `test_deepgram_websocket.html` - Simple HTML test page
- `deepgram_websocket_handler.py` - Backend WebSocket handler
- `DeepgramVoiceComponent.jsx` - React component for your frontend
- `main.py` - Updated with new WebSocket endpoint

## 🎯 Key Features

- **Real-time transcription** with interim and final results
- **Spanish language support** (es-419 for Latin America)
- **Error handling** and connection status
- **Audio quality optimization** (16kHz, mono, noise suppression)
- **Cross-platform compatibility** (works in modern browsers)

## 🔍 Testing

1. **Basic Test**: Use the HTML page to verify everything works
2. **React Integration**: Use the React component in your app
3. **Customization**: Modify the WebSocket handler for your specific needs

## 🚨 Troubleshooting

### Common Issues:

1. **"WebSocket connection failed"**
   - Check if server is running on port 8000
   - Verify `DEEPGRAM_API_KEY` is set in `.env`

2. **"Microphone access denied"**
   - Allow microphone access in browser
   - Check browser permissions

3. **"No transcription results"**
   - Speak clearly and loudly
   - Check Deepgram API key validity
   - Verify internet connection

4. **Audio quality issues**
   - Use a good microphone
   - Reduce background noise
   - Check browser audio settings

## 🔄 Next Steps

Once you've confirmed this works, you can:

1. **Integrate with your existing voice agent** - Replace ElevenLabs with Deepgram
2. **Add conversation history** - Store transcripts in your database
3. **Implement AI responses** - Use the transcript to generate responses
4. **Add user authentication** - Secure the WebSocket connections
5. **Scale for production** - Add connection pooling and error recovery

## 📊 Performance Notes

- **Latency**: Deepgram typically provides results within 200-500ms
- **Accuracy**: Very high accuracy, especially for clear speech
- **Cost**: Deepgram charges per audio minute processed
- **Reliability**: Deepgram has excellent uptime and reliability

## 🎉 Success!

If you see real-time transcription appearing as you speak, congratulations! You now have a working Deepgram integration that you can use as a foundation for your voice agent system. 