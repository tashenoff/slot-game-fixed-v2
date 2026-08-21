from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api', methods=['GET'])
def handler():
    return jsonify({"status": "ok", "message": "Slot Game API"})
