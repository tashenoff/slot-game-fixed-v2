from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/balance', methods=['GET'])
def handler():
    return jsonify({"balance": 1000})
