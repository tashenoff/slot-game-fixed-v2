from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        # Начальный баланс - в serverless окружении состояние не сохраняется
        # Баланс должен храниться на клиенте или в базе данных
        self.wfile.write(json.dumps({"balance": 1000}).encode())
        return
