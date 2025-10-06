import React from 'react';
import SimpleVoiceTranscription from './SimpleVoiceTranscription';

function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f0f2f5',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <header style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <h1 style={{ color: '#333', marginBottom: '10px' }}>
            🎤 Voice Transcription Demo
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Real-time speech-to-text using Deepgram
          </p>
        </header>

        <main>
          <SimpleVoiceTranscription />
        </main>

        <footer style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '20px',
          color: '#666',
          fontSize: '14px'
        }}>
          <p>Powered by Deepgram • Built with React • Backend: FastAPI + WebSocket</p>
        </footer>
      </div>
    </div>
  );
}

export default App; 