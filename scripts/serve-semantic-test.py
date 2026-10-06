"""Local static test server with the same browser isolation required by Moonshine."""
import argparse,http.server,pathlib,threading,webbrowser
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--open',action='store_true');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin');self.send_header('Cross-Origin-Embedder-Policy','require-corp');self.send_header('Cross-Origin-Resource-Policy','same-origin');super().end_headers()
    def log_message(self,*args):pass
print(f'Local test: http://127.0.0.1:{a.port}/semantic-test.html',flush=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler)
if a.open:threading.Timer(.4,lambda:webbrowser.open(f'http://127.0.0.1:{a.port}/index.html')).start()
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close()
