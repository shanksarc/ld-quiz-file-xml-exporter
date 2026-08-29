"""
LearnDash XML Generator - Local Development & Production Server
Automatically finds an open port (8000, 8080, etc.), starts the server,
and opens your browser.
"""

import http.server
import socketserver
import sys
import os
import webbrowser
import threading
import time

DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Redirect root / to /index.html
        if self.path == '/' or self.path == '':
            self.path = '/index.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} -> {args[1]}\n")

def find_available_port(preferred_ports=[8000, 8080, 8888, 3000]):
    for port in preferred_ports:
        try:
            with socketserver.TCPServer(('127.0.0.1', port), CustomHandler) as s:
                return port
        except OSError:
            continue
    return 8000

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    requested_port = int(sys.argv[1]) if len(sys.argv) > 1 else None
    port = requested_port if requested_port else find_available_port()

    server_address = ('0.0.0.0', port)
    
    try:
        httpd = ThreadingHTTPServer(server_address, CustomHandler)
    except OSError:
        # Fallback to 127.0.0.1
        httpd = ThreadingHTTPServer(('127.0.0.1', port), CustomHandler)

    url = f'http://localhost:{port}/index.html'
    print('=' * 70)
    print(' LearnDash XML Question Importer & Generator')
    print('=' * 70)
    print(f' Server active at: {url}')
    print(f' (Also accessible via http://127.0.0.1:{port}/)')
    print(' Press Ctrl+C to stop the server.')
    print('=' * 70)

    # Open browser automatically after 0.5 seconds
    def open_browser():
        time.sleep(0.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped gracefully.')
