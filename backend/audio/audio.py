import elevenlabs

import os
import time
from elevenlabs import ElevenLabs
from io import BytesIO
import wave
from dotenv import load_dotenv
import json
from openai import OpenAI

load_dotenv()

elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))



def pcm_to_wav_bytes(pcm_bytes, sample_rate=16000, channels=1, sampwidth=2):
    wav_buffer = BytesIO()
    with wave.open(wav_buffer, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)  # 2 bytes for int16
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    wav_buffer.seek(0)
    return wav_buffer


async def transcribe_audio_file(audio_bytes: bytes, language_code: str = "es", user_id: str = None, company_id: str = None, session_id: str = None) -> str:
    """Transcribe audio bytes to text using ElevenLabs with language support"""
    try:
        print(f"🎤 STT START: Starting transcription for session {session_id}")
        print(f"🎤 STT INFO: user_id={user_id}, company_id={company_id}, language={language_code}")
        print(f"🎤 STT INFO: Audio size: {len(audio_bytes)} bytes")
        
        from elevenlabs import ElevenLabs
        elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        # Convert audio bytes to a format ElevenLabs can process
        from io import BytesIO
        audio_data = BytesIO(audio_bytes)
        
        # Map language codes to ElevenLabs language codes
        language_mapping = {
            'es': 'es',
            'en': 'en',
            'fr': 'fr',
            'de': 'de',
            'pt': 'pt',
            'it': 'it'
        }
        
        elevenlabs_language = language_mapping.get(language_code, 'es')
        
        # Record start time for duration calculation
        start_time = time.time()
        
        print(f"🎤 STT PROCESSING: Calling ElevenLabs STT with model scribe_v1")
        transcription = elevenlabs.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",
            tag_audio_events=True,
            language_code=elevenlabs_language,
            diarize=False,
        )
        
        # Calculate approximate duration (rough estimate based on audio size)
        # This is an approximation - for more accuracy, you'd need to analyze the actual audio
        estimated_duration_minutes = len(audio_bytes) / (16000 * 2) / 60  # Assuming 16kHz, 16-bit audio
        print(f"🎤 STT DURATION: Estimated duration: {estimated_duration_minutes:.3f} minutes")
        print(f"🎤 STT DURATION: Audio size: {len(audio_bytes)} bytes, Sample rate: 16kHz, Bits: 16")
        
        # Track usage if user info provided
        if user_id and company_id:
            print(f"🎤 STT CREDITS: User and company provided, tracking usage and credits")
            try:
                from main import supabase
                
                # Track STT usage
                print(f"🎤 STT USAGE TRACKING: Tracking usage in database")
                result = supabase.rpc('track_model_usage', {
                    'p_user_id': user_id,
                    'p_company_id': company_id,
                    'p_session_id': session_id or '',
                    'p_model_type': 'stt',
                    'p_provider': 'elevenlabs',
                    'p_model_name': 'scribe_v1',
                    'p_usage_amount': estimated_duration_minutes,
                    'p_metadata': {
                        'audio_size_bytes': len(audio_bytes),
                        'language': language_code,
                        'estimated_duration_minutes': estimated_duration_minutes
                    }
                }).execute()
                print(f"✅ STT USAGE TRACKING: Usage tracked successfully")
                
                # Also track credits using the new credit system
                try:
                    print(f"🎤 STT CREDIT TRACKING: Starting credit deduction")
                    from credits_helper import elevenlabs_stt_with_credits
                    credit_result = await elevenlabs_stt_with_credits(
                        user_id, company_id, estimated_duration_minutes
                    )
                    print(f"✅ STT CREDIT SUCCESS: Credits deducted for ElevenLabs STT: {credit_result['credits_used']} credits")
                    print(f"✅ STT CREDIT SUCCESS: Remaining credits: {credit_result['remaining_credits']} credits")
                except Exception as credit_error:
                    print(f"❌ STT CREDIT ERROR: Error processing STT credits: {credit_error}")
                    import traceback
                    traceback.print_exc()
                
            except Exception as e:
                print(f"❌ STT TRACKING ERROR: Error tracking STT usage: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"⚠️ STT CREDITS: Skipping cost tracking - missing user_id or company_id")
            print(f"⚠️ STT CREDITS: user_id={user_id}, company_id={company_id}")
        
        print(f"🎤 STT COMPLETE: Transcription completed successfully")
        print(f"🎤 STT RESULT: Text length: {len(transcription.text)} characters")
        return transcription.text
    except Exception as e:
        print(f"❌ STT ERROR: Error in transcription: {e}")
        import traceback
        traceback.print_exc()
        return ""

async def synthesize_audio_response(text: str, language_code: str = "es", user_id: str = None, company_id: str = None, session_id: str = None) -> str:
    """Convert text to audio using ElevenLabs with language-specific voice and return as base64"""
    try:
        print(f"🔊 TTS START: Starting audio synthesis for session {session_id}")
        print(f"🔊 TTS INFO: user_id={user_id}, company_id={company_id}, language={language_code}")
        print(f"🔊 TTS INFO: Text length: {len(text)} characters")
        
        import base64
        
        # Language-specific voice mapping
        voice_mapping = {
            'es': 'Pmm5fxQ8MZkUyktbTlMv',      # Spanish voice
            'en': '21m00Tcm4TlvDq8ikWAM',       # English voice
            'fr': 'yoZ06aMxZJJ28mfd3POQ',       # French voice
            'de': 'AZnzlk1XvdvUeBnXmlld',       # German voice
            'pt': 'VR6AewLTigWG4xSOukaG',       # Portuguese voice
            'it': 'EXAVITQu4vr4xnSDxMaL'        # Italian voice
        }
        
        # Get voice ID for the language
        voice_id = voice_mapping.get(language_code, 'Pmm5fxQ8MZkUyktbTlMv')  # Default to Spanish
        model_id = "eleven_flash_v2_5"
        
        print(f"🔊 TTS VOICE: Using voice_id={voice_id} for language={language_code}")
        print(f"🔊 TTS MODEL: Using model_id={model_id}")
        
        print(f"🔊 TTS PROCESSING: Calling ElevenLabs TTS")
        audio = elevenlabs.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id=model_id
        )
        
        # Convert generator to bytes if needed
        if hasattr(audio, '__iter__') and not isinstance(audio, bytes):
            audio_bytes = b''.join(audio)
        else:
            audio_bytes = audio
        
        print(f"🔊 TTS AUDIO: Generated audio size: {len(audio_bytes)} bytes")
        
        # Calculate usage (estimate duration based on text length)
        # Rough estimate: 150 words per minute; words = len(text.split())
        words = max(1, len(text.split()))
        estimated_duration_minutes = words / 150.0  # minutes
        print(f"🔊 TTS DURATION: Estimated duration: {estimated_duration_minutes:.3f} minutes (words={words}, wpm=150)")
        print(f"🔊 TTS DURATION: Text length: {len(text)} chars")
        
        # Track usage if user info provided
        if user_id and company_id:
            print(f"🔊 TTS CREDITS: User and company provided, tracking usage and credits")
            try:
                from main import supabase
                
                # Track TTS usage
                print(f"🔊 TTS USAGE TRACKING: Tracking usage in database")
                result = supabase.rpc('track_model_usage', {
                    'p_user_id': user_id,
                    'p_company_id': company_id,
                    'p_session_id': session_id or '',
                    'p_model_type': 'tts',
                    'p_provider': 'elevenlabs',
                    'p_model_name': 'eleven_flash_v2_5',
                    'p_usage_amount': estimated_duration_minutes,
                    'p_metadata': {
                        'text_length': len(text),
                        'language': language_code,
                        'voice_id': voice_id,
                        'audio_size_bytes': len(audio_bytes),
                        'estimated_duration_minutes': estimated_duration_minutes
                    }
                }).execute()
                print(f"✅ TTS USAGE TRACKING: Usage tracked successfully")
                
                # Also track credits using the new credit system
                try:
                    print(f"🔊 TTS CREDIT TRACKING: Starting credit deduction")
                    from credits_helper import elevenlabs_tts_with_credits
                    credit_result = await elevenlabs_tts_with_credits(
                        user_id, company_id, estimated_duration_minutes
                    )
                    print(f"✅ TTS CREDIT SUCCESS: Credits deducted for ElevenLabs TTS: {credit_result['credits_used']} credits")
                    print(f"✅ TTS CREDIT SUCCESS: Remaining credits: {credit_result['remaining_credits']} credits")
                except Exception as credit_error:
                    print(f"❌ TTS CREDIT ERROR: Error processing TTS credits: {credit_error}")
                    import traceback
                    traceback.print_exc()
                
            except Exception as e:
                print(f"❌ TTS TRACKING ERROR: Error tracking TTS usage: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"⚠️ TTS CREDITS: Skipping cost tracking - missing user_id or company_id")
            print(f"⚠️ TTS CREDITS: user_id={user_id}, company_id={company_id}")
        
        # Convert audio to base64 for API response
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"🔊 TTS COMPLETE: Audio synthesis completed successfully")
        print(f"🔊 TTS RESULT: Base64 audio length: {len(audio_base64)} characters")
        return audio_base64
        
    except Exception as e:
        print(f"❌ TTS ERROR: Error in audio synthesis: {e}")
        import traceback
        traceback.print_exc()
        return ""
    
async def synthesize_audio_response_deepgram(text: str, language_code: str = "es", user_id: str = None, company_id: str = None, session_id: str = None) -> str:
    """Synthesize speech with Deepgram Aura v2 and return base64 audio.
    Mirrors synthesize_audio_response (ElevenLabs) behavior: logs telemetry and deducts credits in background.
    """
    try:
        print(f"🔊 DG TTS START: Starting Aura v2 synthesis for session {session_id}")
        print(f"🔊 DG TTS INFO: user_id={user_id}, company_id={company_id}, language={language_code}")
        print(f"🔊 DG TTS INFO: Text length: {len(text)} characters")

        import base64
        import os
        import requests
        
        api_key = os.getenv("DEEPGRAM_API_KEY")
        if not api_key:
            raise RuntimeError("DEEPGRAM_API_KEY not configured")
        
        # Very simple language→model mapping with safe fallback
        # You can refine with exact Aura v2 voice ids you want to use
        model_mapping = {
            'es': 'aura-2-estrella-es',
            'en': 'aura-asteria-en',
            'fr': 'aura-asteria-fr',
            'de': 'aura-asteria-de',
            'pt': 'aura-asteria-pt',
            'it': 'aura-asteria-it',
        }
        model_id = model_mapping.get(language_code, 'aura-asteria-en')
        model_id = "aura-2-celeste-es"
        print(f"🔊 DG TTS MODEL: Using model_id={model_id}")
        
        # Call Deepgram Speak API (Aura v2)
        # Docs: POST https://api.deepgram.com/v1/speak?model={model_id}
        url = f"https://api.deepgram.com/v1/speak?model={model_id}"
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json"
        }
        payload = {"text": text}
        print("🔊 DG TTS PROCESSING: Calling Deepgram Speak API")
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        if r.status_code >= 300:
            raise RuntimeError(f"Deepgram Speak error {r.status_code}: {r.text[:200]}")
        audio_bytes = r.content
        print(f"🔊 DG TTS AUDIO: Generated audio size: {len(audio_bytes)} bytes")
        
        # Estimate duration (same heuristic as ElevenLabs path): words/150 minutes
        words = max(1, len(text.split()))
        estimated_duration_minutes = words / 150.0
        print(f"🔊 DG TTS DURATION: Estimated duration: {estimated_duration_minutes:.3f} minutes (words={words}, wpm=150)")
        
        # Telemetry (awaited inline)
        if user_id and company_id:
            print(f"🔊 DG TTS CREDITS: User and company provided, tracking usage and scheduling deduction")
            try:
                from main import supabase
                print("🔊 DG TTS USAGE TRACKING: Tracking usage in database")
                supabase.rpc('track_model_usage', {
                    'p_user_id': user_id,
                    'p_company_id': company_id,
                    'p_session_id': session_id or '',
                    'p_model_type': 'tts',
                    'p_provider': 'deepgram',
                    'p_model_name': 'aura_v2',
                    'p_usage_amount': estimated_duration_minutes,
                    'p_metadata': {
                        'text_length': len(text),
                        'language': language_code,
                        'model_id': model_id,
                        'audio_size_bytes': len(audio_bytes),
                        'estimated_duration_minutes': estimated_duration_minutes
                    }
                }).execute()
                print("✅ DG TTS USAGE TRACKING: Usage tracked successfully")

                # Credit deduction (non-blocking), service_type configurable via credit_costs
                try:
                    import asyncio
                    from credits_helper import check_and_use_credits
                    from credits_helper import _round_up_tenth
                    billed_minutes = _round_up_tenth(estimated_duration_minutes)
                    print(f"💰 DG TTS BILLING: Raw minutes={estimated_duration_minutes:.3f}, Billed minutes={billed_minutes:.1f}")
                    async def _deduct_dg_tts():
                        try:
                            result = await check_and_use_credits(
                                user_id, company_id, 'deepgram_aura_v2_tts', billed_minutes,
                                f"Deepgram Aura v2 TTS ({estimated_duration_minutes:.2f} minutes → billed {billed_minutes:.1f}m)"
                            )
                            print(f"✅ DG TTS CREDIT SUCCESS: Credits deducted: {result['credits_used']} | Remaining: {result['remaining_credits']}")
                        except Exception as ex:
                            print(f"❌ DG TTS CREDIT ERROR: {ex}")
                            import traceback; traceback.print_exc()
                    asyncio.create_task(_deduct_dg_tts())
                except Exception as credit_schedule_error:
                    print(f"❌ DG TTS CREDIT ERROR: Failed to schedule credit deduction: {credit_schedule_error}")
                    import traceback; traceback.print_exc()
            except Exception as e:
                print(f"❌ DG TTS TRACKING ERROR: {e}")
                import traceback; traceback.print_exc()
        else:
            print(f"⚠️ DG TTS CREDITS: Skipping cost tracking - missing user_id or company_id (user_id={user_id}, company_id={company_id})")
        
        # Return base64 audio
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        print(f"🔊 DG TTS COMPLETE: Audio synthesis completed successfully (base64 length={len(audio_base64)})")
        return audio_base64
    except Exception as e:
        print(f"❌ DG TTS ERROR: {e}")
        import traceback; traceback.print_exc()
        return ""


async def choose_model_for_tts(model:str, text:str, language_code:str, user_id:str, company_id:str, session_id:str):
    if model == "elevenlabs_flash_v2_5":
        return await synthesize_audio_response(text, language_code="es", user_id=user_id, company_id=company_id, session_id=session_id)
    if model == "deepgram_aura_v2":
        return await synthesize_audio_response_deepgram(text, language_code="es", user_id=user_id, company_id=company_id, session_id=session_id)


def truncate_response_for_voice(text: str, max_words: int = 150) -> str:
    """Truncate response for voice synthesis to avoid long audio generation times"""
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."

def convert_api_response_to_natural_language(api_response: dict, tool_name: str, user_query: str, language_code: str = "es") -> str:
    """
    Convert API response to natural human language using OpenAI with language support
    """
    try:
        # Language-specific prompts
        language_prompts = {
            'es': f"""
You are a helpful Spanish-speaking voice assistant. The user asked: "{user_query}"

The system called the {tool_name} function and got this response:
{json.dumps(api_response, indent=2)}

Please provide a natural, conversational response in Spanish that:
1. Answers the user's question in a friendly way
2. Uses the data from the API response
3. Is concise (max 2-3 sentences)
4. Sounds natural when spoken aloud
5. Doesn't mention technical details like "API response" or "function"
6. Is always in Spanish (español)
7. Uses appropriate Spanish grammar and vocabulary

Respond only with the natural Spanish language response, nothing else.
""",
            'en': f"""
You are a helpful English-speaking voice assistant. The user asked: "{user_query}"

The system called the {tool_name} function and got this response:
{json.dumps(api_response, indent=2)}

Please provide a natural, conversational response in English that:
1. Answers the user's question in a friendly way
2. Uses the data from the API response
3. Is concise (max 2-3 sentences)
4. Sounds natural when spoken aloud
5. Doesn't mention technical details like "API response" or "function"
6. Is always in English
7. Uses appropriate English grammar and vocabulary

Respond only with the natural English language response, nothing else.
""",
            'fr': f"""
Vous êtes un assistant vocal français utile. L'utilisateur a demandé : "{user_query}"

Le système a appelé la fonction {tool_name} et a obtenu cette réponse :
{json.dumps(api_response, indent=2)}

Veuillez fournir une réponse naturelle et conversationnelle en français qui :
1. Répond à la question de l'utilisateur de manière amicale
2. Utilise les données de la réponse API
3. Est concise (max 2-3 phrases)
4. Sonne naturel à l'oral
5. Ne mentionne pas de détails techniques comme "réponse API" ou "fonction"
6. Est toujours en français
7. Utilise une grammaire et un vocabulaire français appropriés

Répondez uniquement avec la réponse naturelle en français, rien d'autre.
""",
            'de': f"""
Sie sind ein hilfreicher deutschsprachiger Sprachassistent. Der Benutzer fragte: "{user_query}"

Das System rief die {tool_name} Funktion auf und erhielt diese Antwort:
{json.dumps(api_response, indent=2)}

Bitte geben Sie eine natürliche, konversationelle Antwort auf Deutsch, die:
1. Die Frage des Benutzers freundlich beantwortet
2. Die Daten aus der API-Antwort verwendet
3. Knapp ist (max 2-3 Sätze)
4. Natürlich klingt, wenn sie gesprochen wird
5. Keine technischen Details wie "API-Antwort" oder "Funktion" erwähnt
6. Immer auf Deutsch ist
7. Angemessene deutsche Grammatik und Wortschatz verwendet

Antworten Sie nur mit der natürlichen deutschen Sprachantwort, nichts anderes.
""",
            'pt': f"""
Você é um assistente de voz português útil. O usuário perguntou: "{user_query}"

O sistema chamou a função {tool_name} e obteve esta resposta:
{json.dumps(api_response, indent=2)}

Por favor, forneça uma resposta natural e conversacional em português que:
1. Responda à pergunta do usuário de forma amigável
2. Use os dados da resposta da API
3. Seja concisa (máx 2-3 frases)
4. Soe natural quando falada
5. Não mencione detalhes técnicos como "resposta da API" ou "função"
6. Seja sempre em português
7. Use gramática e vocabulário português apropriados

Responda apenas com a resposta natural em português, nada mais.
""",
            'it': f"""
Sei un assistente vocale italiano utile. L'utente ha chiesto: "{user_query}"

Il sistema ha chiamato la funzione {tool_name} e ha ottenuto questa risposta:
{json.dumps(api_response, indent=2)}

Per favore fornisci una risposta naturale e conversazionale in italiano che:
1. Risponda alla domanda dell'utente in modo amichevole
2. Usi i dati dalla risposta API
3. Sia concisa (max 2-3 frasi)
4. Suoni naturale quando parlata
5. Non menzioni dettagli tecnici come "risposta API" o "funzione"
6. Sia sempre in italiano
7. Usi grammatica e vocabolario italiano appropriati

Rispondi solo con la risposta naturale in italiano, nient'altro.
"""
        }
        
        prompt = language_prompts.get(language_code, language_prompts['es'])
        
        # Language-specific system messages
        system_messages = {
            'es': "You are a helpful Spanish-speaking voice assistant that converts technical API responses into natural, conversational responses in Spanish.",
            'en': "You are a helpful English-speaking voice assistant that converts technical API responses into natural, conversational responses in English.",
            'fr': "Vous êtes un assistant vocal français utile qui convertit les réponses API techniques en réponses naturelles et conversationnelles en français.",
            'de': "Sie sind ein hilfreicher deutschsprachiger Sprachassistent, der technische API-Antworten in natürliche, konversationelle Antworten auf Deutsch umwandelt.",
            'pt': "Você é um assistente de voz português útil que converte respostas técnicas de API em respostas naturais e conversacionais em português.",
            'it': "Sei un assistente vocale italiano utile che converte risposte tecniche API in risposte naturali e conversazionali in italiano.",
            'hi': "You are a helpful Hindi-speaking voice assistant that converts technical API responses into natural, conversational responses in Hindi."
        }
        
        system_message = system_messages.get(language_code, system_messages['es'])
        
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        natural_response = response.choices[0].message.content.strip()
        print(f"🤖 Converted API response to natural language in {language_code}: '{natural_response}'")
        return natural_response
        
    except Exception as e:
        print(f"❌ Error converting API response to natural language: {e}")
        # Fallback to a simple response in the appropriate language
        fallback_messages = {
            'es': "Encontré la información que solicitaste.",
            'en': "I found the information you requested.",
            'fr': "J'ai trouvé les informations que vous avez demandées.",
            'de': "Ich habe die Informationen gefunden, die Sie angefordert haben.",
            'pt': "Encontrei as informações que você solicitou.",
            'it': "Ho trovato le informazioni che hai richiesto.",
            'hi': "मैंने आपके द्वारा अनुरोधित जानकारी पाया है।"
        }
        
        if isinstance(api_response, dict) and "data" in api_response:
            return f"{fallback_messages.get(language_code, fallback_messages['es'])} {api_response['data']}"
        else:
            return fallback_messages.get(language_code, fallback_messages['es'])