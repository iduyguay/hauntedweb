from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import subprocess
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://127.0.0.1:4187", "http://localhost:4187"}:
            self.send_error(403)
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 50000:
            self.send_error(413)
            return
        try:
            payload = json.loads(self.rfile.read(length))
            if self.path == "/__haunt/generate":
                payload["model"] = "gemma3:4b"
                payload["stream"] = False
                request = urllib.request.Request("http://localhost:11434/api/chat", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
                try:
                    with urllib.request.urlopen(request, timeout=50) as response:
                        body = response.read()
                except urllib.error.HTTPError as error:
                    self.send_response(error.code)
                    self.end_headers()
                    return
                content_type = "application/json"
            elif self.path == "/__haunt/voice":
                text = str(payload.get("text", "")).strip()[:400]
                if not text:
                    self.send_error(400)
                    return
                with tempfile.TemporaryDirectory(prefix="haunted-voice-") as folder:
                    source = Path(folder) / "voice.aiff"
                    target = Path(folder) / "voice.wav"
                    subprocess.run(["/usr/bin/say", "-v", "Whisper", "-r", "145", "-o", str(source)], input=text, text=True, check=True, timeout=20)
                    subprocess.run(["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", str(source), str(target)], check=True, timeout=10)
                    body = target.read_bytes()
                content_type = "audio/wav"
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            self.send_error(503, "Local dialogue or voice unavailable")


if __name__ == "__main__":
    print("Haunted Web live preview: http://127.0.0.1:4187/preview/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 4187), Handler).serve_forever()
