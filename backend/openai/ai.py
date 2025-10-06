"""
Create tools ready for gemini with existing BASE URL with endpoint, 
description of the tool, arguments, and description of each argument, with examples 
"""

from openai import OpenAI
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from typing import List
import requests
import google.generativeai as genai
from urllib.parse import urlencode, quote


load_dotenv()
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL")
BACKEND_API_KEY  = os.getenv("BACKEND_API_KEY")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class Tool(BaseModel):
    endpoint: str
    description: str
    arguments: List[str]
    argument_descriptions: List[str]
    examples: List[str]

TYPE_MAP = {
    "string": "string",
    "integer": "integer",
    "number": "number",
    "boolean": "boolean",
    "object": "object",
    "array": "array",
}


def _headers():
    h = {"Accept": "application/json"}
    if BACKEND_API_KEY:
        h["Authorization"] = f"Bearer {BACKEND_API_KEY}"
    return h


def fetch_gemini_tools_and_router(tenant_id: str):
    url = f"{BACKEND_BASE_URL}/tenants/{tenant_id}/gemini-tools"
    headers = {"Accept": "application/json"}
    if BACKEND_API_KEY:
        headers["Authorization"] = f"Bearer {BACKEND_API_KEY}"
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    # Expecting: {"tools": [...], "router_spec": {...}}
    if "tools" not in data or "router_spec" not in data:
        raise ValueError("Malformed response from /gemini-tools endpoint")
    return data["tools"], data["router_spec"]

def fetch_system_prompt(tenant_id: str, name: str = "default-es"):
    """GET /tenants/{tenant_id}/system-prompt?name=... -> dict with content/variables/model_prefs"""
    if not BACKEND_BASE_URL:
        raise RuntimeError("BACKEND_BASE_URL not set")

    qs = urlencode({"name": name})
    url = f"{BACKEND_BASE_URL}/tenants/{quote(tenant_id)}/system-prompt?{qs}"
    resp = requests.get(url, headers=_headers(), timeout=10)
    resp.raise_for_status()
    data = resp.json()

    # Validate and provide safe defaults
    content = data.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Malformed response: 'content' missing or empty in system prompt payload.")

    return {
        "name": data.get("name", name),
        "version": data.get("version"),
        "content": content,
        "variables": data.get("variables", {}),
        "model_prefs": data.get("model_prefs", {}),
        "locale": data.get("locale"),
        "channel": data.get("channel"),
    }




def build_tool_schema(tool_spec: dict) -> dict:
    props = {}
    required = []
    for arg in tool_spec["args"]:
        t = TYPE_MAP.get(arg["type"], "string")
        props[arg["name"]] = {
            "type": t,
            "description": f'{arg.get("description","")}' + (
                f' Example: {arg.get("example")}' if "example" in arg else ""
            )
        }
        # make required by default; you can add `required: false` to args as an option
        required.append(arg["name"])

    return {
        "name": tool_spec["name"],
        "description": tool_spec["description"] + \
            f" (Endpoint: {tool_spec['method']} {tool_spec['endpoint_template']})",
        "parameters": {
            "type": "object",
            "properties": props,
            "required": required
        }
    }

def build_all_gemini_tools(user_spec: dict) -> list[dict]:
    return [build_tool_schema(t) for t in user_spec["tools"]]

    
import os, re, json, time
import requests
from urllib.parse import urljoin
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class ToolRouter:
    def __init__(self, router_spec: dict, allowed_domains: list[str] = None):
        self.base_url = router_spec["api_base_url"].rstrip("/")
        self.auth = router_spec.get("auth", {"type": "none"})
        self.tools_by_name = {t["name"]: t for t in router_spec["tools"]}
        self.allowed_domains = allowed_domains or [re.escape(self.base_url.split("://",1)[-1].split("/")[0])]

    def _auth_headers(self) -> dict:
        if self.auth["type"] == "bearer":
            token = os.getenv(self.auth["token_env"], "")
            return {"Authorization": f"Bearer {token}"} if token else {}
        if self.auth["type"] == "header":
            name = self.auth["name"]; val = os.getenv(self.auth["value_env"], "")
            return {name: val} if val else {}
        return {}

    def _build_url(self, tool: dict, args: dict) -> str:
        # fill path params
        path = tool["endpoint_template"].format(**args)
        # join with base
        full = urljoin(self.base_url + "/", path.lstrip("/"))
        # very simple allowlist (protect SSRF)
        host = full.split("://",1)[-1].split("/")[0]
        if not any(re.fullmatch(pat, host) for pat in self.allowed_domains):
            raise ValueError("Host not allowed")
        return full

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.3, max=4),
        retry=retry_if_exception_type((requests.RequestException,))
    )
    def _request(self, method, url, headers=None, params=None, json_body=None):
        return requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=10
        )

    def execute(self, tool_name: str, arguments: dict):
        if tool_name not in self.tools_by_name:
            raise ValueError(f"Unknown tool: {tool_name}")

        tool = self.tools_by_name[tool_name]
        method = tool["method"].upper()

        # Split args by location
        path_args = {a["name"]: arguments[a["name"]]
                     for a in tool["args"] if a.get("in","path") == "path"}
        query_args = {a["name"]: arguments[a["name"]]
                      for a in tool["args"] if a.get("in") == "query" and a["name"] in arguments}
        body_args  = {a["name"]: arguments[a["name"]]
                      for a in tool["args"] if a.get("in") == "body" and a["name"] in arguments}

        url = self._build_url(tool, path_args)
        headers = {"Accept": "application/json", **self._auth_headers()}

        resp = self._request(
            method=method,
            url=url,
            headers=headers,
            params=query_args or None,
            json_body=body_args or None
        )

        # normalize output for the model
        try:
            data = resp.json()
        except ValueError:
            data = {"status": resp.status_code, "text": resp.text}

        if not (200 <= resp.status_code < 300):
            return {
                "ok": False,
                "status": resp.status_code,
                "error": data if isinstance(data, dict) else {"message": str(data)}
            }
        return {"ok": True, "data": data}

def run_turn(user_text: str, model, router: ToolRouter):
    # 1) Ask the model
    response = model.generate_content(user_text)

    # 2) If model wants to call a tool
    fc = getattr(response.candidates[0], "function_call", None)
    if fc:
        tool_name = fc.name
        args = dict(fc.args or {})
        tool_result = router.execute(tool_name, args)

        # 3) Return tool result to the model so it can respond naturally
        #    (Depending on SDK: you may pass tool result as a "function_response" part or as text)
        followup = model.generate_content([
            {"role": "user", "parts": [user_text]},
            {"role": "function", "name": tool_name, "parts": [json.dumps(tool_result)]}
        ])
        return followup.text

    # No tool needed
    return response.text

gemini_tools = build_all_gemini_tools(USER_TOOL_SPEC)

# 2) Create the model with those tools
TENANT_ID = os.getenv("TENANT_ID")  

gemini_tools, router_spec = fetch_gemini_tools_and_router(TENANT_ID)

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    tools=gemini_tools,                      # <-- from backend endpoint
    system_instruction=fetch_system_prompt(TENANT_ID)
)

router = ToolRouter(router_spec)             # <-- uses router_spec from backend


# 4) Run a turn
print(run_turn("¿Qué paquetes hay para el modelo 12?", model, router))