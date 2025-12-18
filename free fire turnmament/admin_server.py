import http.server
import socketserver
import webbrowser
import os
import sys

# Admin Server Configuration
PORT = 9005 # Hidden/Private port
ROOT_FILE = "admin-dashboard.html"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=".", **kwargs)
    
    def do_GET(self):
        # Redirect root to admin dashboard
        if self.path == '/':
            self.send_response(302)
            self.send_header('Location', '/' + ROOT_FILE)
            self.end_headers()
            return
        super().do_GET()

def start_admin_server():
    print("\n" + "=" * 50)
    print("  AETHER ADMIN SECURE SERVER")
    print("=" * 50 + "\n")
    print(f"🔒 Secure Admin Panel running at http://localhost:{PORT}/{ROOT_FILE}")
    print("⚠️  KEEP THIS WINDOW OPEN. DO NOT SHARE THIS URL.")
    
    # Change into the correct directory if needed (similar to start_server.py)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("Opening Admin Dashboard...")
            webbrowser.open(f"http://localhost:{PORT}/{ROOT_FILE}")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping admin server...")
    except OSError as e:
        print(f"Error starting admin server: {e}")

if __name__ == "__main__":
    start_admin_server()
