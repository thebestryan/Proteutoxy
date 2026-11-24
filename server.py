#!/usr/bin/env python3
"""
Local launcher for 16-Bit Retro Expert Terminal.
- Serves static files from this directory on localhost.
- Opens the default web browser automatically.
- Shuts down cleanly when EITHER:
    1) The terminal window is closed (SIGINT/SIGTERM/window close), OR
    2) The browser tab/window is closed (via pagehide beacon or missed heartbeat).
  Page refreshes (F5) are handled gracefully via a short reconnect grace period.
"""

import http.server
import os
import signal
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
START_PORT = 8765
END_PORT = 8799
SHUTDOWN_GRACE_SECONDS = 2.5
HEARTBEAT_TIMEOUT_SECONDS = 12.0


class LifecycleState:
    def __init__(self):
        self.lock = threading.Lock()
        self.client_connected = False
        self.last_seen = time.monotonic()
        self.shutdown_deadline = None

    def mark_alive(self):
        with self.lock:
            self.client_connected = True
            self.last_seen = time.monotonic()
            self.shutdown_deadline = None

    def request_shutdown(self):
        with self.lock:
            self.client_connected = True
            self.shutdown_deadline = time.monotonic() + SHUTDOWN_GRACE_SECONDS

    def should_exit(self):
        with self.lock:
            now = time.monotonic()
            if self.shutdown_deadline is not None and now >= self.shutdown_deadline:
                return "Browser closed"
            if self.client_connected and (now - self.last_seen) >= HEARTBEAT_TIMEOUT_SECONDS:
                return "Browser heartbeat timed out"
            return None


lifecycle = LifecycleState()


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class RetroHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format, *args):
        # Keep console clean (suppress noisy per-file request logs)
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            lifecycle.mark_alive()
        super().do_GET()

    def do_POST(self):
        if self.path == "/__heartbeat":
            lifecycle.mark_alive()
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        if self.path == "/__shutdown":
            lifecycle.request_shutdown()
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        self.send_response(404)
        self.end_headers()


def find_available_port():
    for port in range(START_PORT, END_PORT + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 0


def main():
    port = find_available_port()
    server = ThreadedHTTPServer(("127.0.0.1", port), RetroHandler)
    actual_port = server.server_address[1]
    url = f"http://127.0.0.1:{actual_port}/"

    stop_event = threading.Event()

    def trigger_shutdown(reason=""):
        if stop_event.is_set():
            return
        stop_event.set()
        if reason:
            print(f"\n[STOP] {reason}. Shutting down local server...")
        threading.Thread(target=server.shutdown, daemon=True).start()

    def handle_signal(signum, frame):
        trigger_shutdown("Terminal closed / interrupted")

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    def watchdog():
        while not stop_event.is_set():
            reason = lifecycle.should_exit()
            if reason:
                trigger_shutdown(reason)
                break
            time.sleep(0.5)

    threading.Thread(target=watchdog, daemon=True).start()

    print("=====================================================")
    print("  16-BIT RETRO EXPERT TERMINAL")
    print(f"  Running at: {url}")
    print("  Close this window OR close the browser tab to stop.")
    print("=====================================================")

    # Open browser slightly after binding so the first request lands immediately
    threading.Timer(0.35, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
