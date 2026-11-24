#!/usr/bin/env python3
"""
Local launcher for 16-Bit Retro Expert Terminal.
- Serves static files from this directory on localhost.
- Opens the default web browser automatically.
- Uses a persistent SSE (/ __events) connection so backgrounded browser tabs
  never trigger false timeouts, while closing the browser tab (or closing the
  terminal window) cleanly shuts down the server.
- Page refreshes (F5) are handled gracefully via a short reconnect grace period.
"""

import http.server
import signal
import socket
import socketserver
import threading
import time
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
START_PORT = 8765
END_PORT = 8799
SHUTDOWN_GRACE_SECONDS = 2.5


class LifecycleState:
    def __init__(self):
        self.lock = threading.Lock()
        self.active_clients = 0
        self.ever_connected = False
        self.shutdown_deadline = None

    def client_connected(self):
        with self.lock:
            self.active_clients += 1
            self.ever_connected = True
            self.shutdown_deadline = None

    def client_disconnected(self):
        with self.lock:
            self.active_clients = max(0, self.active_clients - 1)
            if self.ever_connected and self.active_clients == 0:
                self.shutdown_deadline = time.monotonic() + SHUTDOWN_GRACE_SECONDS

    def page_loaded(self):
        with self.lock:
            self.shutdown_deadline = None

    def request_shutdown(self):
        with self.lock:
            if self.active_clients <= 1:
                self.shutdown_deadline = time.monotonic() + SHUTDOWN_GRACE_SECONDS

    def should_exit(self):
        with self.lock:
            if (
                self.ever_connected
                and self.active_clients == 0
                and self.shutdown_deadline is not None
                and time.monotonic() >= self.shutdown_deadline
            ):
                return "Browser tab closed"
            return None


lifecycle = LifecycleState()
stop_event = threading.Event()


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class RetroHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format, *args):
        # Keep console clean
        pass

    def do_GET(self):
        if self.path == "/__events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            lifecycle.client_connected()
            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()
                while not stop_event.is_set():
                    time.sleep(1.0)
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
                pass
            finally:
                lifecycle.client_disconnected()
            return

        if self.path in ("/", "/index.html"):
            lifecycle.page_loaded()
        super().do_GET()

    def do_POST(self):
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
            time.sleep(0.4)

    threading.Thread(target=watchdog, daemon=True).start()

    print("=====================================================")
    print("  16-BIT RETRO EXPERT TERMINAL")
    print(f"  Running at: {url}")
    print("  Close this window OR close the browser tab to stop.")
    print("=====================================================")

    threading.Timer(0.35, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        server.server_close()


if __name__ == "__main__":
    main()
