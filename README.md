# Pulpoo AI - Voice Agent Creation Platform

A comprehensive platform for creating, managing, and deploying intelligent voice agents powered by AI. This platform allows users to build custom voice assistants trained on their company's specific data and deploy them through multiple channels including web interfaces, phone calls, and WhatsApp.

## 🚀 Platform Overview

Pulpoo AI is a full-stack voice agent creation platform that combines:
- **Real-time voice transcription** using Deepgram
- **AI-powered conversation** using Google Gemini and OpenAI
- **Text-to-speech synthesis** using ElevenLabs
- **Multi-language support** (50+ languages)
- **Document processing and RAG** (Retrieval Augmented Generation)
- **Credit-based billing system** with Stripe integration
- **Multi-channel deployment** (Web, Phone, WhatsApp)

## 🏗️ Architecture

### Frontend (Next.js + TypeScript)
- **Framework**: Next.js 15.2.4 with React 19
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: React hooks and context
- **Authentication**: Supabase Auth
- **Payments**: Stripe integration
- **Real-time Communication**: WebSocket connections

### Backend (FastAPI + Python)
- **Framework**: FastAPI with Uvicorn
- **Database**: Supabase (PostgreSQL)
- **AI Models**: Google Gemini, OpenAI GPT
- **Voice Services**: Deepgram (STT), ElevenLabs (TTS)
- **Authentication**: Supabase Auth with JWT
- **File Processing**: PDF extraction, web crawling
- **Vector Storage**: Supabase with embeddings

## 🔧 Core Features

### 1. Company & Agent Creation
- **Company Setup**: Users create companies with specific information, files, and website content
- **Document Processing**: Automatic PDF extraction and text processing
- **Website Crawling**: Automatic content extraction from company websites
- **RAG System**: Vector embeddings for intelligent document retrieval
- **Multi-language Support**: 50+ supported languages with voice customization

### 2. Voice Agent System
- **Real-time Transcription**: WebSocket-based audio streaming with Deepgram
- **AI Conversation**: Context-aware responses using company-specific data
- **Voice Synthesis**: Natural voice responses using ElevenLabs
- **Session Management**: Persistent conversation context
- **Multi-modal Interaction**: Voice, text, and file input support

### 3. Document Intelligence
- **PDF Processing**: Automatic text extraction and chunking
- **Web Content Extraction**: Intelligent website crawling and processing
- **Vector Embeddings**: Semantic search capabilities
- **Knowledge Base**: Company-specific information retrieval
- **Content Management**: File upload, storage, and organization

### 4. Multi-Channel Deployment
- **Web Interface**: Real-time voice conversations in browser
- **Phone Integration**: Twilio-powered phone agent deployment
- **WhatsApp Integration**: WhatsApp Business API integration
- **API Access**: RESTful API for custom integrations

### 5. Credit System & Billing
- **Usage Tracking**: Token-based credit consumption
- **Flexible Pricing**: Multiple credit packages
- **Stripe Integration**: Secure payment processing
- **Transaction History**: Detailed usage and payment logs
- **Balance Management**: Real-time credit monitoring

## 🛠️ Technical Implementation

### Voice Processing Pipeline
1. **Audio Capture**: Browser microphone access with WebRTC
2. **Real-time Transcription**: Deepgram WebSocket for live speech-to-text
3. **AI Processing**: Context-aware response generation with company data
4. **Voice Synthesis**: ElevenLabs text-to-speech with language-specific voices
5. **Audio Playback**: Browser audio API for seamless conversation flow

### Document Processing Flow
1. **File Upload**: Multi-format support (PDF, DOC, TXT, etc.)
2. **Content Extraction**: OpenAI-powered text extraction
3. **Text Chunking**: Intelligent text segmentation for optimal retrieval
4. **Vector Embeddings**: OpenAI embeddings stored in Supabase
5. **RAG Integration**: Semantic search for relevant context

### Authentication & Security
- **Supabase Auth**: Secure user authentication and session management
- **JWT Tokens**: Stateless authentication with token validation
- **Row Level Security**: Database-level access control
- **API Protection**: Endpoint-level authentication checks

## 📁 Project Structure

```
agentCreatorFull/
├── backend/                    # FastAPI backend
│   ├── main.py                # Main FastAPI application
│   ├── agent/                 # AI agent logic
│   ├── authentication/        # Auth middleware
│   ├── company/               # Company management
│   ├── voice_agent/           # Voice processing
│   ├── extraction_processing/ # Document processing
│   ├── web_crawling/          # Website content extraction
│   ├── manage_tools/          # Tool management
│   ├── costs/                 # Cost tracking
│   └── credits_helper.py      # Credit system
├── frontend/                  # Next.js frontend
│   ├── app/                   # Next.js app router
│   ├── components/            # React components
│   ├── lib/                   # Utilities and APIs
│   ├── hooks/                 # Custom React hooks
│   └── styles/                # CSS and styling
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/pnpm
- Python 3.9+
- Supabase account
- Deepgram API key
- ElevenLabs API key
- OpenAI API key
- Google Gemini API key
- Stripe account (for payments)
- Twilio account (for phone/WhatsApp)

### Environment Setup

#### Backend Environment Variables
```bash
# Core Services
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key

# Voice Services
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Payment Processing
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Communication
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Application
API_BASE_URL=http://localhost:8000
BASE_URL=http://localhost:3000
```

#### Frontend Environment Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Installation

#### Backend Setup
```bash
cd backend
pip install -r reqs.txt
uvicorn main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install  # or pnpm install
npm run dev  # or pnpm dev
```

### Database Setup
1. Create a Supabase project
2. Run the SQL schema files:
   - `rls_policies_comprehensive.sql`
   - `CREDIT_SYSTEM_SETUP.sql`
3. Set up Row Level Security policies
4. Configure storage buckets for file uploads

## 🔄 Usage Flow

### 1. User Registration & Authentication
- Users sign up through Supabase Auth
- Credit account is automatically created
- User profile and preferences are stored

### 2. Company Creation
- User creates a company with basic information
- Uploads relevant documents (PDFs, text files)
- Optionally provides website URL for content crawling
- System processes and stores content with vector embeddings

### 3. Agent Configuration
- System generates company-specific system prompts
- Configures voice settings based on language preference
- Sets up conversation context and tools
- Creates knowledge base from uploaded content

### 4. Voice Interaction
- User initiates voice conversation through web interface
- Real-time audio transcription captures speech
- AI processes request with company context
- Response is synthesized and played back

### 5. Multi-Channel Deployment
- Deploy to phone numbers via Twilio
- Integrate with WhatsApp Business API
- Embed in websites via API
- Monitor usage and costs

## 💰 Credit System

### Credit Calculation
- **Text Generation**: Based on token usage (input + output)
- **Voice Processing**: Per-minute charges for transcription and synthesis
- **Document Processing**: One-time charges for file processing
- **API Calls**: Per-request charges for external services

### Credit Packages
- **Starter**: 100 credits for testing
- **Professional**: 500 credits for regular use
- **Enterprise**: Custom packages for high-volume usage

### Usage Tracking
- Real-time credit balance monitoring
- Detailed transaction history
- Usage analytics and reporting
- Automatic low-balance notifications

## 🌐 Multi-Language Support

### Supported Languages (50+)
- **European**: Spanish, English, French, German, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Turkish, Czech, Hungarian, Romanian, Bulgarian, Slovak, Slovenian, Croatian, Serbian, Greek, Hebrew
- **Asian**: Chinese, Japanese, Korean, Thai, Vietnamese, Indonesian, Malay, Filipino, Bengali, Urdu, Hindi, Tamil, Telugu, Kannada, Gujarati, Punjabi, Marathi, Oriya, Assamese, Sinhala, Malayalam
- **Middle Eastern**: Arabic, Persian, Amharic, Hebrew
- **African**: Swahili, Yoruba, Igbo, Hausa, Zulu, Xhosa, Afrikaans
- **Other**: Russian, Ukrainian, Georgian, Armenian, Azerbaijani, Kazakh, Kyrgyz, Uzbek, Turkmen, Tajik, Pashto, Nepali, Mongolian

### Language Features
- **Voice Synthesis**: Language-specific ElevenLabs voices
- **Speech Recognition**: Optimized STT models per language
- **Cultural Adaptation**: Formal/informal pronoun support
- **Localized Prompts**: Default system prompts in native languages

## 🔒 Security & Privacy

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **Access Control**: Row-level security in database
- **API Security**: JWT-based authentication
- **File Security**: Secure file upload and storage

### Privacy Compliance
- **GDPR Compliance**: Data processing and deletion capabilities
- **Data Minimization**: Only necessary data collection
- **User Control**: Data export and deletion options
- **Audit Logging**: Comprehensive activity tracking

## 📊 Monitoring & Analytics

### Usage Analytics
- **Conversation Metrics**: Duration, success rates, user satisfaction
- **Cost Tracking**: Real-time usage and billing monitoring
- **Performance Metrics**: Response times, error rates
- **User Behavior**: Engagement patterns and feature usage

### System Health
- **Service Monitoring**: API health and availability
- **Error Tracking**: Comprehensive error logging and alerting
- **Performance Monitoring**: Response time and throughput metrics
- **Resource Usage**: CPU, memory, and storage monitoring

## 🚀 Deployment

### Production Deployment
- **Backend**: Deploy FastAPI with Gunicorn on cloud platforms
- **Frontend**: Deploy Next.js on Vercel or similar platforms
- **Database**: Use Supabase production instance
- **CDN**: Configure for static assets and global distribution

### Scaling Considerations
- **Horizontal Scaling**: Load balancer for multiple backend instances
- **Database Scaling**: Connection pooling and read replicas
- **Caching**: Redis for session and response caching
- **Monitoring**: Comprehensive logging and alerting setup

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Set up local development environment
4. Make changes and test thoroughly
5. Submit a pull request

### Code Standards
- **Backend**: Follow PEP 8 Python style guide
- **Frontend**: Use ESLint and Prettier for code formatting
- **Documentation**: Update README and code comments
- **Testing**: Include unit and integration tests

## 📞 Support

For technical support, feature requests, or bug reports:
- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Community**: Join our developer community for discussions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Supabase**: Database and authentication services
- **Deepgram**: Real-time speech recognition
- **ElevenLabs**: High-quality voice synthesis
- **OpenAI**: Language model and embeddings
- **Google**: Gemini AI integration
- **Stripe**: Payment processing
- **Twilio**: Communication services

---

**Pulpoo AI** - Empowering businesses with intelligent voice agents that understand their unique context and deliver exceptional customer experiences.
