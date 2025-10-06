from fastapi.responses import PlainTextResponse
import os
import requests
from fastapi import FastAPI, Request
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

ACCESS_TOKEN = os.getenv("WA_TOKEN")  # paste temp token for now
PHONE_NUMBER_ID = os.getenv("WA_PHONE_NUMBER_ID")  # from WhatsApp Getting Started
WABA_ID = os.getenv("WA_WABA_ID")

GRAPH = "https://graph.facebook.com/v20.0"  # any recent vXX works


async def send_template_helper(payload: dict):
    """
    payload = {"to": "<E.164 phone>", "template_name": "hello_world", "lang": "en_US"}
    """
    to = payload["to"]
    template = payload.get("template_name", "hello_world")
    lang = payload.get("lang", "en_US")

    url = f"{GRAPH}/{PHONE_NUMBER_ID}/messages"
    data = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": template, "language": {"code": lang}}
    }
    r = requests.post(url, json=data, headers={"Authorization": f"Bearer {ACCESS_TOKEN}"})
    return r.json()

async def create_template_helper(payload: dict):
    url = f"{GRAPH}/{WABA_ID}/message_templates"
    data = {
        "name": payload.get("name"),                 # e.g. pulpoo_demo_1691234567
        "language": payload.get("language", "en_US"),
        "category": payload.get("category", "UTILITY"),
        "components": [
            { "type": "BODY", "text": "Your Pulpoo demo is ready." }
        ]
    }
    r = requests.post(url, json=data, headers={"Authorization": f"Bearer {ACCESS_TOKEN}"})
    return r.json()

# Webhook verification (GET) + receiver (POST)
from fastapi import Query

VERIFY_TOKEN = os.getenv("WA_VERIFY_TOKEN")
def verify_webhook_helper(
    mode: str = Query(None, alias="hub.mode"),
    challenge: str = Query(None, alias="hub.challenge"),
    verify_token: str = Query(None, alias="hub.verify_token"),
):
    if mode == "subscribe" and verify_token == VERIFY_TOKEN:
        return PlainTextResponse(challenge, status_code=200)
    return PlainTextResponse("forbidden", status_code=403)

async def receive_webhook_helper(request: Request):
    body = await request.json()
    print("INCOMING:", body)  # log for your video
    return {"status": "ok"}