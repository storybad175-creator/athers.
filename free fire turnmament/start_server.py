import http.server
import socketserver
import webbrowser
import os
import subprocess
import sys
import time
import threading
FRONTEND_PORT = 8000
API_DIR = "ff_api"

class Handler(http.server.SimpleHTTPRequestHandler):
    
    # Allow address reuse to prevent "Only one usage of each socket address" error
    allow_reuse_address = True

def start_api_server():
    """Start the Flask API server in a subprocess"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    api_path = os.path.join(base_dir, API_DIR, "app.py")
    
    if os.path.exists(api_path):
        print("🎮 Starting Free Fire API Server on port 5000...")
        # Use the same Python interpreter
        subprocess.Popen(
            [sys.executable, api_path],
            cwd=os.path.join(base_dir, API_DIR),
            creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
        )
        time.sleep(2)  # Give API server time to start
        print("✅ API Server running at http://localhost:5000")
    else:
        print("⚠️ API server not found at:", api_path)
        print("   Player data fetch will not work!")

def start_frontend_server():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    try:
        with socketserver.TCPServer(("", FRONTEND_PORT), Handler) as httpd:
            print(f"🌐 Frontend Serving at http://localhost:{FRONTEND_PORT}")
            print("Opening browser...")
            webbrowser.open(f"http://localhost:{FRONTEND_PORT}/index.html")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping servers...")
    except OSError as e:
        print(f"Error starting server: {e}")
        print("Try waiting a few seconds or checking if port 8000 is used.")

def start_server():
    print("\n" + "=" * 50)
    print("  FREE FIRE TOURNAMENT SYSTEM")
    print("=" * 50 + "\n")
    
    # Start API server first (in background)
    start_api_server()
    
    # Start frontend server (blocks)
    start_frontend_server()

if __name__ == "__main__":
    start_server()

