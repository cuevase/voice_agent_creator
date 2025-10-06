import uvicorn
import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, APIRouter
from pydantic import BaseModel
from typing import Any, List, Optional, Dict
from supabase import create_client, Client
import time


load_dotenv()

# ===== LANGUAGE SUPPORT =====

# Supported languages with their configurations
SUPPORTED_LANGUAGES = {
    'es': {
        'name': 'Spanish',
        'flag': '🇪🇸',
        'voice_id': 'Pmm5fxQ8MZkUyktbTlMv',  # Real ElevenLabs voice ID for Spanish
        'stt_language': 'es',
        'default_prompt': 'Eres un asistente de IA útil que habla español.',
        'formal_pronoun': 'usted',
        'informal_pronoun': 'tú'
    },
    'en': {
        'name': 'English',
        'flag': '🇺🇸',
        'voice_id': '21m00Tcm4TlvDq8ikWAM',  # Real ElevenLabs voice ID for English
        'stt_language': 'en',
        'default_prompt': 'You are a helpful AI assistant that speaks English.',
        'formal_pronoun': 'you',
        'informal_pronoun': 'you'
    },
    'fr': {
        'name': 'French',
        'flag': '🇫🇷',
        'voice_id': 'yoZ06aMxZJJ28mfd3POQ',  # Real ElevenLabs voice ID for French
        'stt_language': 'fr',
        'default_prompt': 'Vous êtes un assistant IA utile qui parle français.',
        'formal_pronoun': 'vous',
        'informal_pronoun': 'tu'
    },
    'de': {
        'name': 'German',
        'flag': '🇩🇪',
        'voice_id': 'AZnzlk1XvdvUeBnXmlld',  # Real ElevenLabs voice ID for German
        'stt_language': 'de',
        'default_prompt': 'Sie sind ein hilfreicher KI-Assistent, der Deutsch spricht.',
        'formal_pronoun': 'Sie',
        'informal_pronoun': 'du'
    },
    'pt': {
        'name': 'Portuguese',
        'flag': '🇵🇹',
        'voice_id': 'VR6AewLTigWG4xSOukaG',  # Real ElevenLabs voice ID for Portuguese
        'stt_language': 'pt',
        'default_prompt': 'Você é um assistente de IA útil que fala português.',
        'formal_pronoun': 'você',
        'informal_pronoun': 'tu'
    },
    'it': {
        'name': 'Italian',
        'flag': '🇮🇹',
        'voice_id': 'EXAVITQu4vr4xnSDxMaL',  # Real ElevenLabs voice ID for Italian
        'stt_language': 'it',
        'default_prompt': 'Sei un assistente IA utile che parla italiano.',
        'formal_pronoun': 'lei',
        'informal_pronoun': 'tu'
    }
}

def get_language_config(language_code: str = 'es'):
    """Get language configuration for a given language code"""
    return SUPPORTED_LANGUAGES.get(language_code, SUPPORTED_LANGUAGES['es'])

def get_company_language(company_id: str) -> str:
    """Get the language setting for a company"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            return 'es'  # Default to Spanish
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Get company language setting
        result = supabase.table("companies").select("language").eq("company_id", company_id).execute()
        
        if result.data and result.data[0].get('language'):
            language = result.data[0]['language']
            if language in SUPPORTED_LANGUAGES:
                return language
        
        return 'es'  # Default to Spanish
        
    except Exception as e:
        print(f"Error getting company language: {e}")
        return 'es'  # Default to Spanish

# Module-level functions that can be imported
def get_gemini_tools(company_id: str):
    """Get Gemini tools for a company"""
    try:
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase credentials not available, returning empty tools")
            return []
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Query tools for the company
        tools_res = (supabase.table("tools")
                     .select("*, api_connections!inner(id, api_base_url, auth)")
                     .eq("company_id", company_id)
                     .eq("enabled", True)
                     .order("name", desc=False)
                     .execute())
        tools_rows = tools_res.data or []

        if not tools_rows:
            print(f"No tools found for company_id: {company_id}")
            return []

        tool_ids = [t["id"] for t in tools_rows]
        args_res = (supabase.table("tool_args")
                    .select("*")
                    .in_("tool_id", tool_ids)
                    .execute())
        args_rows = args_res.data or []

        # Group args by tool_id
        args_by_tool = {}
        for a in args_rows:
            args_by_tool.setdefault(a["tool_id"], []).append(a)

        gemini_tools = []
        for t in tools_rows:
            t_args = args_by_tool.get(t["id"], [])

            # Build Gemini schema
            props, required = {}, []
            for a in t_args:
                desc = a.get("description") or ""
                if a.get("example") is not None:
                    desc = f"{desc} Example: {a['example']}"
                if a.get("enum_vals"):
                    desc = f"{desc} Allowed: {a['enum_vals']}"
                props[a["name"]] = {
                    "type": TYPE_MAP.get(a["type"], "string"),
                    "description": desc.strip()
                }
                if a.get("required", True):
                    required.append(a["name"])

            # Build Gemini-compatible tool format with company context
            tool_description = f'{t.get("description","")} (Endpoint: {t["method"]} {t["endpoint_template"]})'
            
            # Add company context to tool description
            if "company" in t.get("name", "").lower() or "worker" in t.get("name", "").lower() or "appointment" in t.get("name", "").lower():
                tool_description += f" [Automatically uses company_id: {company_id}]"
            
            gemini_tool = {
                "name": t["name"],
                "description": tool_description
            }
            
            gemini_tools.append(gemini_tool)

        print(f"Found {len(gemini_tools)} tools for company_id: {company_id}")
        return gemini_tools
        
    except Exception as e:
        print(f"Error getting tools for company_id {company_id}: {e}")
        return []

def get_system_prompt(company_id: str):
    """Get system prompt for a company with dynamic language support"""
    try:
        # Get company language setting
        language_code = get_company_language(company_id)
        language_config = get_language_config(language_code)
        
        
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase credentials not available, returning default prompt")
            return language_config['default_prompt']
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Try different possible column names for company_id
        try:
            # First try with company_id
            p_result = (supabase.table("prompts")
                 .select("*")
                 .eq("company_id", company_id)
                 .eq("active", True)
                 .execute())
            p = p_result.data[0] if p_result.data else None
        except Exception as e:
            print(f"Error querying prompts: {e}")
            p = None
        base_prompt = language_config['default_prompt']
        if p:
            # Get the active version
            try:
                v_result = (supabase.table("prompt_versions")
                     .select("*")
                     .eq("prompt_id", p["id"])
                     .single().execute())
                v = v_result.data if v_result.data else None
                print(f"Version found: {v is not None}")
                if v:
                    base_prompt = v["content"]
                    print(f"Found system prompt for company_id: {company_id}")
                else:
                    print(f"No active version found for prompt, using default")
            except Exception as e:
                print(f"Error getting prompt version: {e}")
                print(f"No active version found for prompt, using default")
        

        # Add company information to the prompt
        company_info = get_company_info_for_prompt(company_id)
        if company_info:
            base_prompt += company_info
            print(f"Added company information to prompt for company_id: {company_id}")
        
        # Inject company documents as fallback when RAG doesn't work
        enhanced_prompt = inject_company_documents_to_prompt(base_prompt, company_id)
        
        # Generate language-specific voice constraints
        voice_constraints = generate_language_specific_constraints(company_id, language_config)
        
        final_prompt = enhanced_prompt + voice_constraints

        
        return final_prompt
        
    except Exception as e:
        print(f"Error getting system prompt for company_id {company_id}: {e}")
        language_config = get_language_config('es')  # Fallback to Spanish
        return language_config['default_prompt']

def generate_language_specific_constraints(company_id: str, language_config: dict) -> str:
    """Generate language-specific voice constraints"""
    
    language_name = language_config['name']
    language_code = language_config.get('stt_language', 'es')
    formal_pronoun = language_config.get('formal_pronoun', 'usted')
    
    # Language-specific instructions
    language_instructions = {
        'es': f"""
IMPORTANT: You are a {language_name}-speaking voice assistant for company ID: {company_id}

- Always respond in {language_name} 
- Be aware of the tools you have available, if you don't have a tool for a specific task, say that you can't do that,
- Keep responses between 50-150 words for most questions
- For complex explanations, limit to 200-250 words maximum
- Use conversational, natural {language_name} that sounds good when spoken
- Don't be very strict with phonetics and syntax, try to understand the user's intent and your role, specially when
you are talking about the company. 
- Avoid long lists or bullet points - use simple sentences
- If you need to provide detailed information, offer to send it via text instead
- Speak directly to the user in a friendly, helpful tone in {language_name}
- Use formal "{formal_pronoun}" when appropriate, but keep it conversational
- Never use language that is not natural language, never talk about code, jsons, ids, or anything that is not natural language
- NEVER return code or code examples - always use the actual tools provided
- When asked about availability, appointments, or scheduling, use the check_availability and create_appointment tools
- Do not write or suggest code - execute the tools directly
- If you see code examples in company documents, ignore them and use the real tools instead
- Your job is to help users, not to write code - always call the appropriate tools
- If you are scheduling an appointment, always let the user know the appointment has been scheduled. 
- Never ever try executing a tool that you don't have, if the user asks you to do something that you don't have a tool for, say that you can't do that,
  but that you can help them with other things, and tell them what you can do. 

When calling tools or APIs, always use company_id: {company_id} unless the user specifies a different company.

Remember: Your responses will be converted to speech, so prioritize clarity and brevity in {language_name}.""",
        
        'en': f"""
IMPORTANT: You are a {language_name}-speaking voice assistant for company ID: {company_id}

- Always respond in {language_name}
- Keep responses between 50-150 words for most questions
- For complex explanations, limit to 200-250 words maximum
- Use conversational, natural {language_name} that sounds good when spoken
- Avoid long lists or bullet points - use simple sentences
- If you need to provide detailed information, offer to send it via text instead
- Speak directly to the user in a friendly, helpful tone in {language_name}
- Never use language that is not natural language, never talk about code, jsons, ids, or anything that is not natural language
- NEVER return code or code examples - always use the actual tools provided
- When asked about availability, appointments, or scheduling, use the check_availability and create_appointment tools
- Do not write or suggest code - execute the tools directly
- If you see code examples in company documents, ignore them and use the real tools instead
- Your job is to help users, not to write code - always call the appropriate tools
- If you are scheduling an appointment, always let the user know the appointment has been scheduled. 
- Never ever try executing a tool that you don't have, if the user asks you to do something that you don't have a tool for, say that you can't do that,
  but that you can help them with other things, and tell them what you can do. 

When calling tools or APIs, always use company_id: {company_id} unless the user specifies a different company.

Remember: Your responses will be converted to speech, so prioritize clarity and brevity in {language_name}.""",
        
        'fr': f"""
IMPORTANT: Vous êtes un assistant vocal {language_name} pour l'entreprise ID: {company_id}

- Répondez toujours en {language_name}
- Gardez les réponses entre 50-150 mots pour la plupart des questions
- Pour les explications complexes, limitez à 200-250 mots maximum
- Utilisez un {language_name} conversationnel et naturel qui sonne bien à l'oral
- Évitez les longues listes ou puces - utilisez des phrases simples
- Si vous devez fournir des informations détaillées, proposez de les envoyer par texte
- Parlez directement à l'utilisateur sur un ton amical et utile en {language_name}
- N'utilisez jamais de langage qui n'est pas naturel, ne parlez jamais de code, jsons, ids, ou quoi que ce soit qui ne soit pas un langage naturel
- NE RETOURNEZ JAMAIS de code ou d'exemples de code - utilisez toujours les outils réels fournis
- Quand on vous demande de la disponibilité, des rendez-vous, ou de la planification, utilisez les outils check_availability et create_appointment
- N'écrivez pas et ne suggérez pas de code - exécutez les outils directement
- Si vous voyez des exemples de code dans les documents de l'entreprise, ignorez-les et utilisez les vrais outils
- Votre travail est d'aider les utilisateurs, pas d'écrire du code - appelez toujours les outils appropriés
- Si vous planifiez un rendez-vous, faites toujours savoir à l'utilisateur que le rendez-vous a été planifié. 
- N'essayez jamais d'exécuter un outil que vous n'avez pas, si l'utilisateur vous demande de faire quelque chose pour lequel vous n'avez pas d'outil, dites que vous ne pouvez pas faire cela,
  mais que vous pouvez les aider avec d'autres choses, et dites-leur ce que vous pouvez faire. 

Lors de l'appel d'outils ou d'API, utilisez toujours company_id: {company_id} sauf si l'utilisateur spécifie une entreprise différente.

Rappelez-vous: Vos réponses seront converties en parole, alors privilégiez la clarté et la brièveté en {language_name}.""",
        
        'de': f"""
WICHTIG: Sie sind ein {language_name}-sprechender Sprachassistent für Unternehmen ID: {company_id}

- Antworten Sie immer auf {language_name}
- Halten Sie Antworten zwischen 50-150 Wörtern für die meisten Fragen
- Für komplexe Erklärungen, begrenzen Sie auf 200-250 Wörter maximal
- Verwenden Sie konversationelles, natürliches {language_name}, das gut klingt, wenn es gesprochen wird
- Vermeiden Sie lange Listen oder Aufzählungspunkte - verwenden Sie einfache Sätze
- Wenn Sie detaillierte Informationen bereitstellen müssen, bieten Sie an, sie per Text zu senden
- Sprechen Sie direkt mit dem Benutzer in einem freundlichen, hilfreichen Ton auf {language_name}
- Verwenden Sie niemals Sprache, die keine natürliche Sprache ist, sprechen Sie niemals über Code, jsons, ids oder irgendetwas, das keine natürliche Sprache ist
- GEBEN SIE NIEMALS Code oder Code-Beispiele zurück - verwenden Sie immer die bereitgestellten echten Tools
- Wenn Sie nach Verfügbarkeit, Terminen oder Planung gefragt werden, verwenden Sie die Tools check_availability und create_appointment
- Schreiben oder schlagen Sie keinen Code vor - führen Sie die Tools direkt aus
- Wenn Sie Code-Beispiele in Unternehmensdokumenten sehen, ignorieren Sie sie und verwenden Sie die echten Tools
- Ihre Aufgabe ist es, Benutzern zu helfen, nicht Code zu schreiben - rufen Sie immer die entsprechenden Tools auf
- Wenn Sie einen Termin planen, lassen Sie den Benutzer immer wissen, dass der Termin geplant wurde. 
- Versuchen Sie niemals, ein Tool auszuführen, das Sie nicht haben. Wenn ein Benutzer Sie bittet, etwas zu tun, für das Sie kein Tool haben, sagen Sie, dass Sie das nicht können,
  aber dass Sie ihnen mit anderen Dingen helfen können, und sagen Sie ihnen, was Sie tun können. 

Beim Aufrufen von Tools oder APIs verwenden Sie immer company_id: {company_id}, es sei denn, der Benutzer gibt ein anderes Unternehmen an.

Denken Sie daran: Ihre Antworten werden in Sprache umgewandelt, also priorisieren Sie Klarheit und Kürze auf {language_name}.""",
        
        'pt': f"""
IMPORTANTE: Você é um assistente de voz {language_name} para a empresa ID: {company_id}

- Sempre responda em {language_name}
- Mantenha as respostas entre 50-150 palavras para a maioria das perguntas
- Para explicações complexas, limite a 200-250 palavras no máximo
- Use {language_name} conversacional e natural que soa bem quando falado
- Evite listas longas ou marcadores - use frases simples
- Se você precisar fornecer informações detalhadas, ofereça para enviá-las por texto
- Fale diretamente com o usuário em um tom amigável e útil em {language_name}
- Nunca use linguagem que não seja linguagem natural, nunca fale sobre código, jsons, ids, ou qualquer coisa que não seja linguagem natural
- NUNCA retorne código ou exemplos de código - sempre use as ferramentas reais fornecidas
- Quando perguntado sobre disponibilidade, compromissos ou agendamento, use as ferramentas check_availability e create_appointment
- Não escreva ou sugira código - execute as ferramentas diretamente
- Se você vir exemplos de código nos documentos da empresa, ignore-os e use as ferramentas reais
- Seu trabalho é ajudar usuários, não escrever código - sempre chame as ferramentas apropriadas
- Se você está agendando um compromisso, sempre deixe o usuário saber que o compromisso foi agendado. 
- Nunca tente executar uma ferramenta que você não tem, se o usuário pedir para você fazer algo que você não tem uma ferramenta para, diga que você não pode fazer isso,
  mas que você pode ajudá-los com outras coisas, e diga-lhes o que você pode fazer. 

Ao chamar ferramentas ou APIs, sempre use company_id: {company_id} a menos que o usuário especifique uma empresa diferente.

Lembre-se: Suas respostas serão convertidas em fala, então priorize clareza e brevidade em {language_name}.""",
        
        'it': f"""
IMPORTANTE: Sei un assistente vocale {language_name} per l'azienda ID: {company_id}

- Rispondi sempre in {language_name}
- Mantieni le risposte tra 50-150 parole per la maggior parte delle domande
- Per spiegazioni complesse, limita a 200-250 parole massimo
- Usa {language_name} conversazionale e naturale che suona bene quando parlato
- Evita liste lunghe o punti elenco - usa frasi semplici
- Se devi fornire informazioni dettagliate, offri di inviarle via testo
- Parla direttamente con l'utente in un tono amichevole e utile in {language_name}
- Non usare mai linguaggio che non sia linguaggio naturale, non parlare mai di codice, jsons, ids, o qualsiasi cosa che non sia linguaggio naturale
- NON RESTITUIRE MAI codice o esempi di codice - usa sempre gli strumenti reali forniti
- Quando ti viene chiesto di disponibilità, appuntamenti o pianificazione, usa gli strumenti check_availability e create_appointment
- Non scrivere o suggerire codice - esegui gli strumenti direttamente
- Se vedi esempi di codice nei documenti aziendali, ignorali e usa gli strumenti reali
- Il tuo lavoro è aiutare gli utenti, non scrivere codice - chiama sempre gli strumenti appropriati
- Se stai pianificando un appuntamento, fai sempre sapere all'utente che l'appuntamento è stato pianificato. 
- Non provare mai a eseguire uno strumento che non hai, se l'utente ti chiede di fare qualcosa per cui non hai uno strumento, di' che non puoi farlo,
  ma che puoi aiutarli con altre cose, e di' loro cosa puoi fare. 

Quando chiami strumenti o API, usa sempre company_id: {company_id} a meno che l'utente non specifichi un'azienda diversa.

Ricorda: Le tue risposte saranno convertite in parola, quindi priorizza chiarezza e brevità in {language_name}."""
    }
    
    return language_instructions.get(language_code, language_instructions['es'])

def get_company_info(company_id: str):
    """Get company information from Supabase"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase credentials not available")
            return None
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Get company info
        company_result = (supabase.table("companies")
                         .select("*")
                         .eq("company_id", company_id)
                         .single().execute())
        
        if not company_result.data:
            print(f"No company found for company_id: {company_id}")
            return None
            
        return company_result.data
        
    except Exception as e:
        print(f"Error getting company info for company_id {company_id}: {e}")
        return None

def get_company_info_for_prompt(company_id: str):
    """Get company info formatted for system prompt injection"""
    company_info = get_company_info(company_id)
    if not company_info:
        return ""
    
    # Format company info for prompt
    info_parts = []
    if company_info.get("name"):
        info_parts.append(f"Company Name: {company_info['name']}")
    if company_info.get("description"):
        info_parts.append(f"Description: {company_info['description']}")
    if company_info.get("services"):
        info_parts.append(f"Services: {company_info['services']}")
    if company_info.get("contact_info"):
        info_parts.append(f"Contact: {company_info['contact_info']}")
    
    if info_parts:
        return f"\n\nCompany Information:\n" + "\n".join(info_parts)
    return ""

async def search_company_documents(company_id: str, query: str, limit: int = 5):
    """Search company documents using vector similarity"""
    try:
        from extraction_processing.vectors.vector import search_similar_chunks
        
        print(f"🔍 Searching documents for company_id: {company_id}, query: '{query}'")
        
        # Actually call the async function
        similar_chunks = await search_similar_chunks(query, company_id, limit)
        
        if not similar_chunks:
            print(f"🔍 No similar chunks found for query: '{query}'")
            return []
        
        # Format results for context
        formatted_results = []
        for chunk in similar_chunks[:limit]:
            formatted_results.append({
                "content": chunk.get("content", ""),
                "metadata": chunk.get("metadata", {}),
                "similarity": chunk.get("similarity", 0)
            })
        
        print(f"✅ Found {len(formatted_results)} relevant chunks")
        return formatted_results
        
    except Exception as e:
        print(f"Error searching company documents: {e}")
        return []

def format_rag_context(query: str, search_results: list):
    """Format RAG search results for prompt injection"""
    if not search_results:
        return ""
    
    context_parts = [f"Relevant information for query '{query}':"]
    
    for i, result in enumerate(search_results, 1):
        content = result.get("content", "")
        metadata = result.get("metadata", {})
        similarity = result.get("similarity", 0)
        
        # Add source info if available
        source_info = ""
        if metadata.get("source"):
            source_info = f" (Source: {metadata['source']})"
        
        context_parts.append(f"{i}. {content}{source_info}")
    
    return "\n\n" + "\n".join(context_parts)

def get_company_documents_from_storage(company_id: str):
    """Get company documents from Supabase storage"""
    start_time = time.time()
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        # S3 credentials for Supabase storage
        s3_access_key = os.getenv("S3_ACCESS_KEY")
        s3_secret_key = os.getenv("S3_SECRET_KEY")
        s3_region = os.getenv("S3_REGION", "us-east-1")
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase credentials not available")
            return ""
        
        if not s3_access_key or not s3_secret_key:
            print("⚠️ S3 credentials not available - add S3_ACCESS_KEY and S3_SECRET_KEY to .env")
            return ""
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Get company info to find storage path
        company_result = (supabase.table("companies")
                         .select("*")
                         .eq("company_id", company_id)
                         .single().execute())
        
        if not company_result.data:
            print(f"No company found for company_id: {company_id}")
            return ""
        
        company_data = company_result.data
        files = company_data.get("files", [])
        
        if not files:
            return ""
        
        # Get documents from storage
        documents_content = []
        for file_path in files:
            try:
                # Extract bucket name and file path
                path_parts = file_path.split('/', 1)
                if len(path_parts) == 2:
                    bucket_name = path_parts[0]
                    file_path_without_bucket = path_parts[1]
                else:
                    # If no bucket name in path, use client-files
                    bucket_name = "client-files"
                    file_path_without_bucket = file_path
                
                
                try:
                    file_response = supabase.storage.from_(bucket_name).download(file_path_without_bucket)
                    if file_response:
                        # Try to extract text from the file
                        file_text = None
                        
                        # First try to decode as UTF-8 (for text files)
                        try:
                            file_text = file_response.decode('utf-8')
                            print(f"✅ Loaded text document: {file_path} ({len(file_response)} bytes)")
                        except UnicodeDecodeError:
                            # It's a binary file, try to extract text from PDF
                            if file_path.lower().endswith('.pdf'):
                                try:
                                    # Try to extract text from PDF using PyPDF2
                                    import PyPDF2
                                    from io import BytesIO
                                    
                                    pdf_file = BytesIO(file_response)
                                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                                    
                                    text_content = []
                                    for page in pdf_reader.pages:
                                        text_content.append(page.extract_text())
                                    
                                    file_text = '\n'.join(text_content)
                                    
                                except ImportError:
                                    print(f"⚠️ PyPDF2 not installed - skipping PDF: {file_path}")
                                    print("   Install with: pip install PyPDF2")
                                    continue
                                except Exception as pdf_error:
                                    print(f"⚠️ Could not extract text from PDF {file_path}: {pdf_error}")
                                    continue
                            else:
                                print(f"⚠️ Binary file (not PDF) - skipping: {file_path}")
                                continue
                        
                        if file_text:
                            documents_content.append(f"Document: {file_path}\n{file_text}")
                    else:
                        print(f"⚠️ Could not load document: {file_path}")
                        
                except Exception as bucket_error:
                    print(f"❌ Failed to download from bucket '{bucket_name}': {bucket_error}")
                    continue
                    
            except Exception as e:
                print(f"Error loading document {file_path}: {e}")
                continue
        
        if documents_content:
            combined_content = "\n\n".join(documents_content)
            end_time = time.time()
            return combined_content
        
        else:
            print(f"No documents could be loaded for company_id: {company_id}")
            return ""
        
    except Exception as e:
        print(f"Error getting company documents for company_id {company_id}: {e}")
        return ""

def filter_code_from_documents(content: str) -> str:
    """Filter out code blocks and code examples from document content"""
    import re
    
    # Remove code blocks (```...```)
    content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
    
    # Remove single line code (lines starting with import, def, class, etc.)
    lines = content.split('\n')
    filtered_lines = []
    
    for line in lines:
        # Skip lines that look like code
        if (line.strip().startswith(('import ', 'from ', 'def ', 'class ', 'if __name__', 'return ', 'print(')) or
            line.strip().startswith(('# Mock', '# In a real', '# For this'))):
            continue
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)

def inject_company_documents_to_prompt(base_prompt: str, company_id: str):
    """Inject company documents into the system prompt"""
    documents_content = get_company_documents_from_storage(company_id)
    
    if documents_content:
        # Filter out code from documents
        filtered_content = filter_code_from_documents(documents_content)
        
        # Add documents to the prompt
        enhanced_prompt = f"{base_prompt}\n\nCompany Documents:\n{filtered_content}"
        return enhanced_prompt
    else:
        print("📄 No company documents to inject")
        return base_prompt

# FastAPI app for tools endpoints
tools_app = FastAPI()
router = APIRouter()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

TYPE_MAP = {"string":"string","integer":"integer","number":"number","boolean":"boolean","object":"object","array":"array"}

class GeminiToolsResponse(BaseModel):
    tools: list[dict]
    router_spec: dict

class ToolArgCreate(BaseModel):
    name: str
    type: str  # e.g., "string", "int", etc.
    location: str  # "query", "body", "path"
    required: bool = True
    description: Optional[str] = None
    example: Optional[str] = None
    enum_vals: Optional[List[str]] = None

class ToolCreate(BaseModel):
    name: str
    description: Optional[str]
    method: str
    endpoint_template: str
    api_connection_id: str  # existing api_connections.id
    args: Optional[List[ToolArgCreate]] = []

class PromptFragment(BaseModel):
    name: str
    content: str
    position: int  # e.g., 0 for top, 1, etc.

class PromptVersionCreate(BaseModel):
    version: int
    content: str
    locale: Optional[str] = None
    channel: Optional[str] = None
    model_prefs: Optional[dict] = {}
    variables: Optional[dict] = {}
    fragments: Optional[List[PromptFragment]] = []

class PromptCreate(BaseModel):
    name: str
    version_data: PromptVersionCreate

class APIAuthConfig(BaseModel):
    type: Optional[str]  # e.g. "bearer", "header", "basic", etc.
    token: Optional[str]
    headers: Optional[Dict[str, str]]

class APIConnectionCreate(BaseModel):
    name: str
    api_base_url: str
    auth: Optional[APIAuthConfig] = None


@tools_app.get("/tenants/{tenant_id}/gemini-tools", response_model=GeminiToolsResponse)
def get_gemini_tools_endpoint(tenant_id: str, sb: Client = Depends(get_sb)):
    # 1) load tools + join api_connections
    tools_res = (sb.table("tools")
                 .select("*, api_connections!inner(id, api_base_url, auth)")
                 .eq("company_id", tenant_id)
                 .eq("enabled", True)
                 .order("name", desc=False)
                 .execute())
    tools_rows = tools_res.data or []

    if not tools_rows:
        return {"tools": [], "router_spec": {"api_base_url": None, "auth": None, "tools": []}}

    tool_ids = [t["id"] for t in tools_rows]
    args_res = (sb.table("tool_args")
                .select("*")
                .in_("tool_id", tool_ids)
                .execute())
    args_rows = args_res.data or []

    # group args by tool_id
    args_by_tool = {}
    for a in args_rows:
        args_by_tool.setdefault(a["tool_id"], []).append(a)

    # assume same api_connection for simplicity; if multiple, you can split per-connection
    api_base_url = tools_rows[0]["api_connections"]["api_base_url"]
    auth_conf = tools_rows[0]["api_connections"]["auth"]

    gemini_tools = []
    router_spec = {
        "api_base_url": api_base_url,
        "auth": auth_conf,
        "tools": []
    }

    for t in tools_rows:
        t_args = args_by_tool.get(t["id"], [])

        # ---- Gemini schema ----
        props, required = {}, []
        for a in t_args:
            desc = a.get("description") or ""
            if a.get("example") is not None:
                desc = f"{desc} Example: {a['example']}"
            if a.get("enum_vals"):
                desc = f"{desc} Allowed: {a['enum_vals']}"
            props[a["name"]] = {
                "type": TYPE_MAP.get(a["type"], "string"),
                "description": desc.strip()
            }
            if a.get("required", True):
                required.append(a["name"])

        # Build Gemini-compatible tool format
        gemini_tool = {
            "name": t["name"],
            "description": f'{t.get("description","")} (Endpoint: {t["method"]} {t["endpoint_template"]})',
            "parameters": {
                "properties": props,
                "required": required
            }
        }
        
        gemini_tools.append(gemini_tool)

        # ---- Router spec (for your executor) ----
        router_spec["tools"].append({
            "name": t["name"],
            "method": t["method"],
            "endpoint_template": t["endpoint_template"],
            "args": [{
                "name": a["name"],
                "type": a["type"],
                "in": a["location"],
                "required": a["required"]
            } for a in t_args]
        })

    return {"tools": gemini_tools, "router_spec": router_spec}



@router.get("/tenants/{tenant_id}/system-prompt")
def get_system_prompt_endpoint(company_id: str, name: str = "default-es", sb: Client = Depends(get_sb)):
    # load prompt
    p = (sb.table("prompts")
         .select("*")
         .eq("company_id", company_id)
         .eq("name", name)
         .single().execute()).data
    
    print(f"Prompt: {p}")

    if not p:
        raise HTTPException(404, "Prompt not found")

    # active version
    v = (sb.table("prompt_versions")
         .select("*")
         .eq("id", p["active_version_id"])
         .single().execute()).data
    if not v:
        raise HTTPException(404, "Active prompt version not set")

    # optional fragments
    frags = (sb.table("prompt_version_fragments")
             .select("position, fragment_id, prompt_fragments!inner(id, name, content)")
             .eq("prompt_version_id", v["id"])
             .order("position").execute()).data or []
    pieces = [f["prompt_fragments"]["content"] for f in frags]
    content = "\n\n".join(pieces + [v["content"]]) if pieces else v["content"]

    return {
        "name": p["name"],
        "version": v["version"],
        "locale": v.get("locale"),
        "channel": v.get("channel"),
        "model_prefs": v.get("model_prefs") or {},
        "variables": v.get("variables") or {},
        "content": content
    }


@router.post("/companies/{company_id}/tools")
def create_tool(company_id: str, tool: ToolCreate, sb: Client = Depends(get_sb)):
    tool_data = {
        "tenant_id": company_id,  
        "name": tool.name,
        "description": tool.description,
        "method": tool.method,
        "endpoint_template": tool.endpoint_template,
        "enabled": True,
        "api_connection_id": tool.api_connection_id,
    }

    created_tool = sb.table("tools").insert(tool_data).execute().data[0]

    for arg in tool.args:
        sb.table("tool_args").insert({
            "tool_id": created_tool["id"],
            "name": arg.name,
            "type": arg.type,
            "location": arg.location,
            "required": arg.required,
            "description": arg.description,
            "example": arg.example,
            "enum_vals": arg.enum_vals
        }).execute()

    return {"message": "Tool created", "tool_id": created_tool["id"]}


@router.post("/companies/{company_id}/system-prompt")
def create_prompt(company_id: str, prompt: PromptCreate, sb: Client = Depends(get_sb)):
    # Create prompt
    prompt_res = sb.table("prompts").insert({
        "tenant_id": company_id,  # change to "company_id" if that's the column name
        "name": prompt.name
    }).execute()
    prompt_id = prompt_res.data[0]["id"]

    # Create prompt version
    version_data = prompt.version_data
    version_res = sb.table("prompt_versions").insert({
        "prompt_id": prompt_id,
        "version": version_data.version,
        "content": version_data.content,
        "locale": version_data.locale,
        "channel": version_data.channel,
        "model_prefs": version_data.model_prefs,
        "variables": version_data.variables,
    }).execute()
    version_id = version_res.data[0]["id"]

    # Set this version as the active one
    sb.table("prompts").update({
        "active_version_id": version_id
    }).eq("id", prompt_id).execute()


    return {"message": "Prompt and version created", "prompt_id": prompt_id}



@router.post("/companies/{company_id}/api-connections")
def create_api_connection(company_id: str, conn: APIConnectionCreate, sb: Client = Depends(get_sb)):
    conn_data = {
        "company_id": company_id,  # or "company_id" if your Supabase column is named that
        "name": conn.name,
        "api_base_url": conn.api_base_url,
        "auth": conn.auth.dict() if conn.auth else None
    }

    created = sb.table("api_connections").insert(conn_data).execute().data[0]
    return {"message": "API connection created", "api_connection_id": created["id"]}



tools_app.include_router(router)








"""
Example of how to create a tool: 
curl -X POST http://localhost:8000/companies/abc123/tools \
-H "Content-Type: application/json" \
-d '{
  "name": "get_weather",
  "description": "Fetch weather data",
  "method": "GET",
  "endpoint_template": "/weather?city={city}",
  "api_connection_id": "conn-789",
  "args": [
    {
      "name": "city",
      "type": "string",
      "location": "query",
      "required": true,
      "description": "City name to fetch weather for",
      "example": "Mexico City",
      "enum_vals": ["Mexico City", "New York", "Tokyo"]
    }
  ]
}'
"""