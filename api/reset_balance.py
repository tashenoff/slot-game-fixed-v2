from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/reset_balance', methods=['POST', 'OPTIONS'])
def handler():
    return jsonify({"balance": 1000})
