from supabase import create_client, Client
from main import ToolCreate
from database_utils import get_sb
from fastapi import Depends
import os   
from dotenv import load_dotenv
from fastapi import HTTPException   
from main import API_BASE_URL
from pulpoo import crear_tarea_pulpoo
from main import PULPOO_API_KEY
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def create_company_tool_helper(company_id: str, tool: ToolCreate, sb: Client = Depends(get_sb)):
    tool_data = {
        "company_id": company_id,  
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

def add_check_availability_tool_to_company_helper(company_id: str):
    """Add check availability tool to a company"""
    
    # Check if API_BASE_URL is set
    if not API_BASE_URL:
        raise HTTPException(400, "API_BASE_URL environment variable is not set")
    
    try:
        # Insert API connection
        connection_result = supabase.table('api_connections').insert({
            'name': 'connection_check_availability',
            'company_id': company_id,
            'api_base_url': API_BASE_URL,
        }).execute()
        
        api_connection_id = connection_result.data[0]['id'] if connection_result.data else None
        
        if not api_connection_id:
            raise HTTPException(500, "Failed to create API connection")
        
        # Insert tool
        tool_result = supabase.table('tools').insert({
            'api_connection_id': api_connection_id,
            'name': 'check_availability',
            'description': 'Check availability for appointments',
            'method': 'GET',
            'endpoint_template': '/check_availability?company_id={company_id}&day={day}&start_time={start_time}',
            'enabled': True,
            'version': 1,
            'company_id': company_id,
        }).execute()
        
        tool_id = tool_result.data[0]['id'] if tool_result.data else None
        
        if not tool_id:
            raise HTTPException(500, "Failed to create tool")
        
        # Insert tool arguments
        tool_args = [
            {
                'tool_id': tool_id,
                'name': 'day',
                'description': 'The day to check availability for',
                'location': 'query',
                'example': 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
                'type': 'string',
                'required': True,
            },
            {
                'tool_id': tool_id,
                'name': 'start_time',
                'description': 'The start time to check availability for',
                'location': 'query',
                'example': '09:00, 10:00, 11:00',
                'type': 'string',
                'required': True,
            },
            {
                'tool_id': tool_id,
                'name': 'company_id',
                'description': 'The company id to check availability for',
                'location': 'query',
                'example': 'company-uuid-here',
                'type': 'string',
                'required': True,
            }
        ]
        
        for arg in tool_args:
            supabase.table('tool_args').insert(arg).execute()
        
        return {
            "message": "Check availability tool added successfully",
            "api_connection_id": api_connection_id,
            "tool_id": tool_id,
            "company_id": company_id
        }
        
    except Exception as e:
        print(f"❌ Error adding check availability tool: {e}")
        raise HTTPException(500, f"Failed to add tool: {str(e)}")
    

def add_create_appointment_tool_to_company_helper(company_id: str):
    """Add create appointment tool to a company"""

    connection_result = supabase.table('api_connections').insert({
            'name': 'connection_check_availability',
            'company_id': company_id,
            'api_base_url': API_BASE_URL,
        }).execute()
    api_connection_id = connection_result.data[0]['id'] if connection_result.data else None

    tool_result = supabase.table("tools").insert({
        "api_connection_id": api_connection_id,
        "name": "create_appointment",
        "description": "Create appointment",
        "method": "POST",
        "endpoint_template": "/create_appointment?company_id={company_id}&day={day}&start_time={start_time}",
        "enabled": True,
        "version": 1,
        "company_id": company_id,  # Add the missing company_id field
    }).execute()
    tool_id = tool_result.data[0]['id'] if tool_result.data else None
    tool_args = [
        {
            "tool_id": tool_id,
            "name": "company_id",
            "description": "The company id to create appointment for",
            "location": "query",
            "example": "company-uuid-here",
            "type": "string",
            "required": True,
        },
        {
            "tool_id": tool_id,
            "name": "day",
            "description": "The day to create appointment for",
            "location": "query",
            "example": "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday",
            "type": "string",
            "required": True,
        },
        {
            "tool_id": tool_id,
            "name": "start_time", 
            "description": "The start time to create appointment for",
            "location": "query",
            "example": "09:00, 10:00, 11:00",
            "type": "string",
            "required": True,
        }
    ]
    for arg in tool_args:
        supabase.table("tool_args").insert(arg).execute()
    return {"message": "Create appointment tool added successfully", "company_id": company_id}
        # Insert API connection

def create_appointment_tool_helper(company_id: str, day: str, start_time: str):
    """Create an appointment for a company"""
    try:
        # Get company name
        get_company_name = supabase.table("companies").select("company_name").eq("company_id", company_id).execute()
        if not get_company_name.data:
            return {"message": "Company not found", "company_id": company_id}
        company_name = get_company_name.data[0]['company_name']
        
        # First get workers for this company
        get_workers = supabase.table('workers').select('*').eq('company_id', company_id).execute()
        if not get_workers.data:
            return {"message": "No workers found for this company", "company_id": company_id}
        
        workers = get_workers.data
        
        # Check if any worker is available at the specified time
        available_workers = []
        for worker in workers:
            worker_availability = supabase.table("worker_availability").select("*").eq("worker_id", worker['worker_id']).eq("start_time", start_time).eq("day", day).eq("available", True).execute()
            if worker_availability.data:
                available_workers.extend(worker_availability.data)
        
        if not available_workers:
            return {"message": "No worker available at the specified time and day", "company_id": company_id}
        
        # Use the first available worker
        selected_worker_availability = available_workers[0]
        selected_worker_id = selected_worker_availability['worker_id']
        
        # Update availability to False (book the slot)
        supabase.table("worker_availability").update({
            "available": False
        }).eq("worker_id", selected_worker_id).eq("day", day).eq("start_time", start_time).execute()
        
        # Create task in Pulpoo (fix date parsing)
        try:
            # Parse the date properly - assuming day is like "Monday" and start_time is like "09:00"
            from datetime import datetime, timedelta
            import calendar
            
            # Get current date and find the next occurrence of the specified day
            today = datetime.now()
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            day_index = day_names.index(day)
            
            # Find next occurrence of this day
            days_ahead = day_index - today.weekday()
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            target_date = today + timedelta(days=days_ahead)
            
            # Combine with start_time
            appointment_datetime = datetime.combine(target_date.date(), datetime.strptime(start_time, "%H:%M").time())
            
            # Create task in Pulpoo
            crear_tarea_pulpoo(
                f"Appointment for {company_name}", 
                f"Create appointment for {selected_worker_id} on {day} at {start_time}", 
                appointment_datetime, 
                PULPOO_API_KEY
            )
            
        except Exception as e:
            print(f"⚠️ Error creating Pulpoo task: {e}")
            # Continue even if Pulpoo task creation fails
        
        return {
            "message": "Appointment created successfully", 
            "company_id": company_id,
            "worker_id": selected_worker_id,
            "day": day,
            "start_time": start_time
        }
        
    except Exception as e:
        print(f"❌ Error creating appointment: {e}")
        return {"message": f"Error creating appointment: {str(e)}", "company_id": company_id}



    

def check_availability_tool_helper(company_id: str, day: str, start_time: str):
    """Get availability of a company"""
    if not supabase:
        raise HTTPException(500, "Supabase not configured")
    get_workers = supabase.table('workers').select('*').eq('company_id', company_id).execute()
    workers = get_workers.data
    result = supabase.table('worker_availability').select('*').eq('worker_id', workers[0]['worker_id']).eq('day', day).eq('start_time', start_time).eq('available', True).execute()
    return {"message": "Availability fetched successfully", "data": result.data}