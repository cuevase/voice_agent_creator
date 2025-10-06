import requests
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv
import os

load_dotenv()

PULPOO_API_KEY = os.getenv("PULPOO_API_KEY")


def crear_tarea_pulpoo(title: str, description: str, deadline: str, pulpoo_api_key: str = None) -> dict:
    """
    Crea una tarea en Pulpoo usando su API.
    
    Args:
        title: Título de la tarea
        description: Descripción detallada de la tarea
        deadline: Fecha límite en formato ISO (YYYY-MM-DDTHH:MM:SSZ)
        pulpoo_api_key: API key de Pulpoo (se pasa como parámetro desde las funciones)
    
    Returns:
        dict: Resultado de la operación con éxito/error
    """
    if not PULPOO_API_KEY:
        print(f"API key de Pulpoo no configurado: {PULPOO_API_KEY}")
        return {"success": False, "error": "API key de Pulpoo no configurado"}
    print("HEREE!")
    url = "https://api.pulpoo.com/v1/external/tasks/create"
    headers = {
        "X-API-Key": PULPOO_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "title": title,
        "description": description,
        "assigned_to_email": "cuevas@pulpoo.com",
        "deadline": deadline,
        "importance": "HIGH"
    }
    
    try:
        print(f"--- Creando tarea en Pulpoo: {title} ---")
        response = requests.post(url, headers=headers, json=data, timeout=10)
        
        if response.status_code == 200 or response.status_code == 201:
            return {"success": True, "data": response.json()}
        else:
            return {"success": False, "error": f"Error HTTP {response.status_code}: {response.text}"}
            
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Timeout al conectar con Pulpoo"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Error de conexión con Pulpoo"}
    except Exception as e:
        return {"success": False, "error": f"Error inesperado: {str(e)}"}