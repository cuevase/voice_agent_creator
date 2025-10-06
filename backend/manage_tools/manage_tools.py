from supabase import create_client, Client
import os   
from dotenv import load_dotenv
from typing import List, Dict, Optional
from pydantic import BaseModel
from openai import OpenAI
import re
import aiohttp
from urllib.parse import urljoin


load_dotenv()


# Type mapping for Gemini tools
TYPE_MAP = {
    "string": "string",
    "integer": "integer", 
    "number": "number",
    "boolean": "boolean",
    # Remove "object" and "array" as they're not valid for Gemini tool parameters
}

def arg(name, type_, location, required, description, example="", enum_vals=None):
    return {
        "name": name, "type": type_, "location": location, "required": required,
        "description": description, "example": example, "enum_vals": enum_vals or []
    }

def upsert_tool_with_args(sb: Client, company_id: str, api_connection_id: str,
                          name: str, description: str, method: str,
                          endpoint_template: str, args: list[dict]):
    # Find existing by (company_id, name)
    existing = sb.table("tools").select("*").eq("company_id", company_id).eq("name", name).execute().data
    if existing:
        tool = existing[0]
        sb.table("tools").update({
            "description": description,
            "method": method,
            "endpoint_template": endpoint_template,
            "enabled": True,
            "api_connection_id": api_connection_id
        }).eq("id", tool["id"]).execute()

        # Replace args (simplest)
        sb.table("tool_args").delete().eq("tool_id", tool["id"]).execute()
        for a in args:
            sb.table("tool_args").insert({**a, "tool_id": tool["id"]}).execute()
        return tool
    else:
        tool = sb.table("tools").insert({
            "company_id": company_id,
            "name": name,
            "description": description,
            "method": method,
            "endpoint_template": endpoint_template,
            "enabled": True,
            "api_connection_id": api_connection_id
        }).execute().data[0]
        for a in args:
            sb.table("tool_args").insert({**a, "tool_id": tool["id"]}).execute()
        return tool

class ToolRouter:
    """Router to execute tools based on Supabase configuration"""
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
        # join with base - strip any trailing whitespace from base_url
        clean_base_url = self.base_url.rstrip()
        full = urljoin(clean_base_url + "/", path.lstrip("/"))
        # very simple allowlist (protect SSRF)
        host = full.split("://",1)[-1].split("/")[0]
        if not any(re.fullmatch(pat, host) for pat in self.allowed_domains):
            raise ValueError("Host not allowed")
        return full

    async def _request(self, method, url, headers=None, params=None, json_body=None):
        timeout = aiohttp.ClientTimeout(total=15)  # Increased timeout
        async with aiohttp.ClientSession(timeout=timeout) as session:
            try:
                if method == "GET":
                    async with session.get(url, headers=headers, params=params) as resp:
                        return await resp.json() if resp.status == 200 else {"status": resp.status, "text": await resp.text()}
                elif method == "POST":
                    async with session.post(url, headers=headers, json=json_body) as resp:
                        return await resp.json() if resp.status == 200 else {"status": resp.status, "text": await resp.text()}
                elif method == "PUT":
                    async with session.put(url, headers=headers, json=json_body) as resp:
                        return await resp.json() if resp.status == 200 else {"status": resp.status, "text": await resp.text()}
                elif method == "DELETE":
                    async with session.delete(url, headers=headers) as resp:
                        return await resp.json() if resp.status == 200 else {"status": resp.status, "text": await resp.text()}
                else:
                    raise ValueError(f"Unsupported method: {method}")
            except aiohttp.ClientError as e:
                print(f"❌ HTTP request error: {e}")
                return {"status": "error", "text": f"Connection error: {str(e)}"}
            except Exception as e:
                print(f"❌ Unexpected error in HTTP request: {e}")
                return {"status": "error", "text": f"Unexpected error: {str(e)}"}

    async def execute(self, tool_name: str, arguments: dict):
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
        print(f"🔗 Making request to: {url}")
        headers = {
            "Accept": "application/json", 
            "ngrok-skip-browser-warning": "true",  # Skip ngrok warning page
            **self._auth_headers()
        }

        resp = await self._request(
            method=method,
            url=url,
            headers=headers,
            params=query_args or None,
            json_body=body_args or None
        )

        # Handle the response data
        if isinstance(resp, dict) and "status" in resp and resp["status"] == "error":
            return {
                "ok": False,
                "status": "error",
                "error": resp["text"]
            }
        
        # Check if it's a successful response
        if isinstance(resp, dict) and "status" in resp and resp["status"] != 200:
            return {
                "ok": False,
                "status": resp["status"],
                "error": resp.get("text", "Unknown error")
            }
        
        # Success case
        return {"ok": True, "data": resp}

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def fetch_gemini_tools_and_router(company_id: str):
    """Fetch tools and router spec from Supabase"""
    try:
        if not supabase:
            raise RuntimeError("Supabase not configured")
        
        # Query tools for the company
        tools_res = (supabase.table("tools")
                     .select("*, api_connections!inner(id, api_base_url, auth)")
                     .eq("company_id", company_id)
                     .eq("enabled", True)
                     .order("name", desc=False)
                     .execute())
        tools_rows = tools_res.data or []

        if not tools_rows:
            return [], {}


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

        # Build router spec
        api_base_url = tools_rows[0]["api_connections"]["api_base_url"]
        
        router_spec = {
            "api_base_url": api_base_url,
            "auth": tools_rows[0]["api_connections"]["auth"] or {"type": "none"},
            "tools": []
        }

        # Build tools for router
        for t in tools_rows:
            t_args = args_by_tool.get(t["id"], [])
            router_tool = {
                "name": t["name"],
                "method": t["method"],
                "endpoint_template": t["endpoint_template"],
                "args": t_args
            }
            router_spec["tools"].append(router_tool)

        return tools_rows, router_spec
        
    except Exception as e:
        print(f"Error fetching tools for company_id {company_id}: {e}")
        return [], {}

def build_gemini_tools_from_supabase(tools_rows: list, company_id: str):
    """Build Gemini-compatible tools from Supabase data"""
    try:
        if not tools_rows:
            return []

        tool_ids = [t["id"] for t in tools_rows]
        
        # Get args for all tools
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

            # Build Gemini-compatible tool format
            tool_description = f'{t.get("description","")} (Endpoint: {t["method"]} {t["endpoint_template"]})'
            
            # Add company context to tool description
            if "company" in t.get("name", "").lower() or "worker" in t.get("name", "").lower() or "appointment" in t.get("name", "").lower():
                tool_description += f" [Automatically uses company_id: {company_id}]"
            
            # Create tool spec in the format expected by build_tool_schema
            tool_spec = {
                "name": t["name"],
                "description": tool_description,
                "method": t["method"],
                "endpoint_template": t["endpoint_template"],
                "args": t_args
            }
            
            # Build the actual Gemini tool schema
            gemini_tool = build_tool_schema(tool_spec)
            gemini_tools.append(gemini_tool)


        return gemini_tools
        
    except Exception as e:
        print(f"Error building Gemini tools for company_id {company_id}: {e}")
        return []

def build_tool_schema(tool_spec: dict) -> dict:
    """Build a single Gemini tool schema from tool spec"""
    props = {}
    required = []
    for arg in tool_spec["args"]:
        # Only include valid types for Gemini tools
        arg_type = arg["type"]
        if arg_type in TYPE_MAP:
            t = TYPE_MAP[arg_type]
            props[arg["name"]] = {
                "type": t,
                "description": f'{arg.get("description","")}' + (
                    f' Example: {arg.get("example")}' if "example" in arg else ""
                )
            }
            # make required by default; you can add `required: false` to args as an option
            required.append(arg["name"])
        else:
            print(f"⚠️ Skipping arg '{arg['name']}' with unsupported type '{arg_type}'")

    return {
        "function_declarations": [
            {
                "name": tool_spec["name"],
                "description": tool_spec["description"],
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": required
                }
            }
        ]
    }

async def dispatch_tool_with_router(name: str, args: dict, company_id: str, user_id: str = None, session_id: str = None):
    """Dispatch tool using Supabase router configuration"""
    try:
        print(f"🔧 Dispatching tool with router: {name} with args: {args}")
        print(f"👤 Tool tracking: user_id={user_id}, company_id={company_id}, session_id={session_id}")
        
        # Convert MapComposite to dict if needed
        if hasattr(args, 'items'):
            args_dict = dict(args.items())
        else:
            args_dict = args or {}
        
        print(f"🔧 Converted args: {args_dict}")
        
        # Fetch tools and router from Supabase
        tools_rows, router_spec =  fetch_gemini_tools_and_router(company_id)
        
        if not tools_rows or not router_spec:
            print(f"⚠️ No tools found for company_id: {company_id}")
            return f"No tools configured for company {company_id}"
        
        # Create router with allowed domains
        allowed_domains = [
            re.escape(router_spec["api_base_url"].split("://",1)[-1].split("/")[0]),
            "39e547b6a29c\\.ngrok-free\\.app",  # Allow ngrok domain
            "localhost",
            "127\\.0\\.0\\.1"
        ]
        router = ToolRouter(router_spec, allowed_domains=allowed_domains)
        
        # Execute tool through router
        result = await router.execute(name, args_dict)
        
        # Track tool usage if user info provided
        if user_id and company_id:
            try:
                from main import supabase
                
                # Calculate usage (1 API call = 1 usage unit)
                usage_amount = 1
                
                print(f"📊 Calling track_model_usage RPC for tool:")
                print(f"   - user_id: {user_id}")
                print(f"   - company_id: {company_id}")
                print(f"   - session_id: {session_id or 'None'}")
                print(f"   - model_type: tool")
                print(f"   - provider: custom")
                print(f"   - model_name: {name}")
                print(f"   - usage_amount: {usage_amount}")
                
                # Track tool usage
                tool_result = supabase.rpc('track_model_usage', {
                    'p_user_id': user_id,
                    'p_company_id': company_id,
                    'p_session_id': session_id or '',
                    'p_model_type': 'tool',
                    'p_provider': 'custom',
                    'p_model_name': name,
                    'p_usage_amount': usage_amount,
                    'p_metadata': {
                        'tool_name': name,
                        'args': args_dict,
                        'success': result.get("ok", False)
                    }
                }).execute()
                
                print(f"✅ Tool usage tracking successful: {name} for user {user_id}")
                print(f"📊 Tool RPC result: {tool_result}")
                
            except Exception as e:
                print(f"❌ Error tracking tool usage: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"⚠️ Skipping tool cost tracking - missing user_id or company_id")
        
        if result.get("ok"):
            print(f"✅ Tool {name} executed successfully via router")
            return result["data"]  # Return the actual data, not JSON string
        else:
            print(f"❌ Tool {name} failed via router: {result}")
            return f"Tool execution failed: {result.get('error', 'Unknown error')}"
            
    except Exception as e:
        print(f"❌ Error dispatching tool {name}: {e}")
        return f"Error executing {name}: {str(e)}"