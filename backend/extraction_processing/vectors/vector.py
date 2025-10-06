import os 
from dotenv import load_dotenv
from supabase import create_client
from openai import OpenAI
import tiktoken

load_dotenv()

#------------Keys------------

PULPOO_API_KEY = os.getenv("PULPOO_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

#----------Clients------------

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken"""
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except:
        # Fallback: rough estimation (1 token ≈ 4 characters)
        return len(text) // 4

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks"""
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
        
        if start >= len(text):
            break
    
    return chunks

async def get_embedding(text: str) -> list[float]:
    """Get embedding for text using OpenAI"""
    try:
        response = openai_client.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return []

async def store_embeddings_in_supabase(chunks: list[str], company_id: str, file_path: str):
    """Store text chunks and their embeddings in Supabase"""
    try:
        embeddings_data = []
        
        for i, chunk in enumerate(chunks):
            embedding = await get_embedding(chunk)
            if embedding:
                embeddings_data.append({
                    'company_id': company_id,
                    'file_path': file_path,
                    'chunk_index': i,
                    'content': chunk,
                    'embedding': embedding,
                    'token_count': count_tokens(chunk)
                })
        
        # Insert embeddings into Supabase
        if embeddings_data:
            result = supabase.table('document_embeddings').insert(embeddings_data).execute()
            print(f"Stored {len(embeddings_data)} embeddings for {file_path}")
            return True
        return False
        
    except Exception as e:
        print(f"Error storing embeddings: {e}")
        return False

async def search_similar_chunks(query: str, company_id: str, top_k: int = 5) -> list[dict]:
    """Search for similar chunks using vector similarity"""
    try:
        # Get query embedding
        query_embedding = await get_embedding(query)
        if not query_embedding:
            return []
        
        # Search in Supabase using vector similarity
        result = supabase.rpc(
            'match_documents',
            {
                'query_embedding': query_embedding,
                'match_threshold': 0.7,
                'match_count': top_k,
                'company_id': company_id
            }
        ).execute()
        
        return result.data if result.data else []
        
    except Exception as e:
        print(f"Error searching embeddings: {e}")
        return []