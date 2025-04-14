#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get Groq API credentials
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_BASE = os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1")

def test_groq_api():
    """Test connection to Groq API"""
    print(f"Using Groq API Key: {GROQ_API_KEY[:5]}...{GROQ_API_KEY[-5:]}")
    print(f"Using Groq API Base: {GROQ_API_BASE}")
    
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama3-8b-8192",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, can you hear me?"}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }
    
    try:
        response = requests.post(
            f"{GROQ_API_BASE}/chat/completions",
            headers=headers,
            json=payload
        )
        
        # Print response status and headers
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {response.headers}")
        
        # Check if the request was successful
        response.raise_for_status()
        
        # Print the response
        response_json = response.json()
        print("Response JSON:", response_json)
        
        # Extract the generated content
        content = response_json["choices"][0]["message"]["content"]
        print(f"Generated content: {content}")
        
        return True
    except Exception as e:
        print(f"Error testing Groq API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response content: {e.response.content}")
        return False

if __name__ == "__main__":
    test_groq_api()
