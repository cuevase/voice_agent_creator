"""
Credit System Helper Functions
Integrates credit checking and usage tracking with existing services
"""

import os
from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from database_utils import get_sb
import math

supabase = get_sb()

def _round_up_tenth(value: float) -> float:
    return math.ceil(max(0.0, value) * 10.0) / 10.0

async def check_and_use_credits(user_id: str, company_id: str, usage_type: str, amount: float, description: str = None) -> dict:
    """
    Check if user has enough credits and deduct them
    Returns: dict with credits_used and remaining_credits
    """
    try:
        print(f"💰 CREDIT CHECK: Starting credit check for {usage_type}")
        print(f"💰 CREDIT CHECK: user_id={user_id}, company_id={company_id}, amount={amount}")
        
        # Calculate credits needed
        credits_needed = calculate_credits_needed(usage_type, amount)
        # Round up to 0.1 credits for minute-based granular charges already applied in amount; keep as-is here
        credits_needed = float(credits_needed)
        print(f"💰 CREDIT CALCULATION: {usage_type} with {amount} units = {credits_needed} credits needed")
        
        # Get current balance
        result = supabase.table("user_credits").select("credits_balance").eq("user_id", user_id).execute()
        
        if not result.data:
            print(f"❌ CREDIT ERROR: No credit account found for user {user_id}")
            raise HTTPException(status_code=402, detail="No credit account found. Please purchase credits first.")
        
        current_balance = result.data[0]["credits_balance"]
        print(f"💰 CREDIT BALANCE: Current balance for user {user_id}: {current_balance} credits")
        
        # Check if user has enough credits
        if current_balance < credits_needed:
            print(f"❌ CREDIT ERROR: Insufficient credits. Need {credits_needed}, have {current_balance}")
            raise HTTPException(
                status_code=402, 
                detail=f"Insufficient credits. Need {credits_needed}, have {current_balance}. Please purchase more credits."
            )
        
        # Get current total_credits_used first
        current_used_result = supabase.table("user_credits").select("total_credits_used").eq("user_id", user_id).execute()
        current_used = current_used_result.data[0]["total_credits_used"] if current_used_result.data else 0
        print(f"💰 CREDIT USAGE: Current total used: {current_used} credits")
        
        # Deduct credits
        new_balance = float(current_balance) - credits_needed
        new_total_used = float(current_used) + credits_needed
        print(f"💰 CREDIT DEDUCTION: Deducting {credits_needed} credits")
        print(f"💰 CREDIT DEDUCTION: New balance will be {new_balance} credits")
        print(f"💰 CREDIT DEDUCTION: New total used will be {new_total_used} credits")
        
        supabase.table("user_credits").update({
            "credits_balance": new_balance,
            "total_credits_used": new_total_used,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("user_id", user_id).execute()
        
        print(f"✅ CREDIT SUCCESS: Successfully deducted {credits_needed} credits")
        print(f"✅ CREDIT SUCCESS: New balance: {new_balance} credits")
        
        # Log transaction
        transaction_data = {
            "user_id": user_id,
            "company_id": company_id,
            "transaction_type": "usage",
            "credits_amount": -credits_needed,
            "description": description or f"{usage_type} usage ({amount} units)"
        }
        print(f"💰 TRANSACTION LOG: Logging transaction: {transaction_data}")
        
        supabase.table("credit_transactions").insert(transaction_data).execute()
        print(f"✅ TRANSACTION LOG: Transaction logged successfully")
        
        return {
            "credits_used": credits_needed,
            "remaining_credits": new_balance,
            "usage_type": usage_type,
            "amount": amount
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ CREDIT ERROR: Error using credits: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing credits: {str(e)}")

def calculate_credits_needed(usage_type: str, amount: float) -> float:
    """Calculate credits needed for a specific usage"""
    try:
        print(f"💰 PRICE LOOKUP: Looking up cost for service type: {usage_type}")
        
        # Special-case LLM flat pricing (credits when 1 credit = 1 MXN):
        # - gemini-pro / gemini-2.5-pro: ~0.2 credits per 1K tokens total (input+output)
        # - gemini-1.5-pro: ~0.1 credits per 1K tokens total
        # - gemini-2.5-flash / gemini-1.5-flash: ~0.1 credits per 1K tokens total
        # Add 20% FX/overhead buffer
        llm_flat_per_1k = {
            "gemini-pro": 0.24,
            "gemini-2.5-pro": 0.24,
            "gemini-1.5-pro": 0.12,
            "gemini-2.5-flash": 0.12,
            "gemini-1.5-flash": 0.12,
        }
        if usage_type in llm_flat_per_1k:
            credits_needed = llm_flat_per_1k[usage_type] * float(amount) / 1000.0
            # round up to 0.1 credit
            credits_needed = math.ceil(credits_needed * 10.0) / 10.0
            print(f"💰 LLM FLAT CALC: {usage_type} {amount} tokens → {credits_needed} credits (rounded up to 0.1)")
            return credits_needed
        
        # Get cost from database for non-LLM unit pricing
        result = supabase.table("credit_costs").select("cost_per_unit").eq("service_type", usage_type).eq("is_active", True).execute()
        
        if not result.data:
            print(f"⚠️ PRICE WARNING: No cost found for service type: {usage_type}, using default cost of 1")
            base_cost = 1.0
        else:
            base_cost = float(result.data[0]["cost_per_unit"])
            print(f"💰 PRICE FOUND: {usage_type} costs {base_cost} credits per unit")
        
        # Unit-based (minutes etc.) with 0.1 rounding
        credits_needed = base_cost * float(amount)
        credits_needed = math.ceil(credits_needed * 10.0) / 10.0
        print(f"💰 UNIT CALCULATION: {amount} units * {base_cost} = {credits_needed} credits (rounded up to 0.1)")
        print(f"💰 FINAL CALCULATION: {usage_type} with {amount} units = {credits_needed} credits needed")
        return credits_needed
            
    except Exception as e:
        print(f"❌ PRICE ERROR: Error getting cost for {usage_type}: {e}")
        # Fallback to default cost
        fallback_cost = float(amount)
        print(f"💰 FALLBACK: Using fallback cost of {fallback_cost} credits")
        return fallback_cost

async def get_user_credits(user_id: str) -> dict:
    """Get user's current credit balance"""
    try:
        print(f"💰 BALANCE CHECK: Getting credit balance for user {user_id}")
        
        result = supabase.table("user_credits").select("*").eq("user_id", user_id).execute()
        
        if not result.data:
            print(f"💰 BALANCE CHECK: No credit account found, creating new account for user {user_id}")
            # Create new credit record if doesn't exist
            supabase.table("user_credits").insert({
                "user_id": user_id,
                "credits_balance": 0,
                "total_credits_purchased": 0,
                "total_credits_used": 0
            }).execute()
            print(f"💰 BALANCE CHECK: Created new credit account with 0 balance")
            return {"credits_balance": 0, "total_purchased": 0, "total_used": 0}
        
        credit_data = result.data[0]
        balance = credit_data["credits_balance"]
        total_purchased = credit_data["total_credits_purchased"]
        total_used = credit_data["total_credits_used"]
        
        print(f"💰 BALANCE CHECK: User {user_id} has {balance} credits")
        print(f"💰 BALANCE CHECK: Total purchased: {total_purchased}, Total used: {total_used}")
        
        return {
            "credits_balance": balance,
            "total_purchased": total_purchased,
            "total_used": total_used
        }
        
    except Exception as e:
        print(f"❌ BALANCE ERROR: Error getting user credits: {e}")
        return {"credits_balance": 0, "total_purchased": 0, "total_used": 0}

# Integration examples for existing services
async def voice_call_with_credits(user_id: str, company_id: str, duration_minutes: int):
    """Handle voice call with credit checking"""
    print(f"💰 VOICE CALL: Processing voice call credits for {duration_minutes} minutes")
    return await check_and_use_credits(
        user_id, company_id, 
        "voice_call", duration_minutes,
        f"Voice call ({duration_minutes} minutes)"
    )

async def ai_response_with_credits(user_id: str, company_id: str, model: str, token_count: int):
    """Handle AI response with credit checking"""
    print(f"💰 AI RESPONSE: Processing AI response credits for {model} with {token_count} tokens")
    return await check_and_use_credits(
        user_id, company_id,
        model, token_count,
        f"AI response using {model} ({token_count} tokens)"
    )

async def bundle_creation_with_credits(user_id: str, company_id: str):
    """Handle bundle creation with credit checking"""
    print(f"💰 BUNDLE CREATION: Processing bundle creation credits")
    return await check_and_use_credits(
        user_id, company_id,
        "bundle_creation", 1,
        "Regulatory bundle creation"
    )

async def document_upload_with_credits(user_id: str, company_id: str, document_type: str):
    """Handle document upload with credit checking"""
    print(f"💰 DOCUMENT UPLOAD: Processing document upload credits for {document_type}")
    return await check_and_use_credits(
        user_id, company_id,
        "document_upload", 1,
        f"Document upload ({document_type})"
    )

# New functions for STT and TTS with updated pricing
async def deepgram_stt_with_credits(user_id: str, company_id: str, duration_minutes: float):
    """Handle Deepgram STT Nova 2 with credit checking (0.0058 USD per minute)"""
    billed_minutes = _round_up_tenth(duration_minutes)
    print(f"💰 DEEPGRAM STT: Raw minutes={duration_minutes:.3f}, Billed minutes={billed_minutes:.1f}")
    print(f"💰 DEEPGRAM STT: Rate: $0.0058/min = 1 credit/min")
    return await check_and_use_credits(
        user_id, company_id,
        "deepgram_nova_2_stt", billed_minutes,
        f"Deepgram STT Nova 2 ({duration_minutes:.2f} minutes → billed {billed_minutes:.1f}m)"
    )

async def elevenlabs_tts_with_credits(user_id: str, company_id: str, duration_minutes: float):
    """Handle ElevenLabs Flash v2.5 TTS with credit checking (0.15 USD per minute)"""
    billed_minutes = _round_up_tenth(duration_minutes)
    print(f"💰 ELEVENLABS TTS: Raw minutes={duration_minutes:.3f}, Billed minutes={billed_minutes:.1f}")
    print(f"💰 ELEVENLABS TTS: Rate: $0.15/min = 15 credits/min")
    return await check_and_use_credits(
        user_id, company_id,
        "elevenlabs_flash_v2_5_tts", billed_minutes,
        f"ElevenLabs Flash v2.5 TTS ({duration_minutes:.2f} minutes → billed {billed_minutes:.1f}m)"
    )

async def elevenlabs_stt_with_credits(user_id: str, company_id: str, duration_minutes: float):
    """Handle ElevenLabs STT with credit checking"""
    billed_minutes = _round_up_tenth(duration_minutes)
    print(f"💰 ELEVENLABS STT: Raw minutes={duration_minutes:.3f}, Billed minutes={billed_minutes:.1f}")
    print(f"💰 ELEVENLABS STT: Rate: $0.000278/min = 1 credit/min")
    return await check_and_use_credits(
        user_id, company_id,
        "elevenlabs_scribe_v1_stt", billed_minutes,
        f"ElevenLabs STT ({duration_minutes:.2f} minutes → billed {billed_minutes:.1f}m)"
    )

async def deepgram_stt_chars_with_credits(user_id: str, company_id: str, char_count: int):
    """Charge Deepgram STT by characters. Expects cost_per_unit in credit_costs as credits per 1 char.
    To set pricing: cost_per_unit = (USD_TO_MXN * 0.03) / 1000 for deepgram_nova_2_stt_char.
    """
    print(f"💰 DEEPGRAM STT (chars): char_count={char_count}")
    return await check_and_use_credits(
        user_id, company_id,
        "deepgram_nova_2_stt_char", float(char_count),
        f"Deepgram STT by characters ({char_count} chars)"
    ) 