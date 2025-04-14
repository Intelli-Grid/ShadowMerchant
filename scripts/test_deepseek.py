#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get Deepseek API credentials
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")

def test_deepseek_api():
    """Test connection to Deepseek API"""
    print(f"Using Deepseek API Key: {DEEPSEEK_API_KEY[:5]}...{DEEPSEEK_API_KEY[-5:]}")
    print(f"Using Deepseek API Base: {DEEPSEEK_API_BASE}")
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, can you hear me?"}
        ],
        "max_tokens": 100,
        "temperature": 0.7
    }
    
    try:
        response = requests.post(
            f"{DEEPSEEK_API_BASE}/v1/chat/completions",
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
        print(f"Error testing Deepseek API: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response content: {e.response.content}")
        return False

if __name__ == "__main__":
    test_deepseek_api()
