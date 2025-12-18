"""
Custom Free Fire API Server
Local JSON Backend + Multiple fallback backends for player info

Endpoints:
- GET /api/player?uid=<player_uid>
- GET /api/health

Database Endpoints:
- GET/POST /api/db/users
- GET/POST /api/db/tournaments
- POST /api/db/registrations
- GET /api/db/registrations?tournamentId=<id>
- POST /api/db/results
- GET /api/db/results?tournamentId=<id>
- POST /api/db/wallet/transaction
- GET /api/db/wallet/<email>
- GET/POST /api/db/withdrawals
- GET/POST /api/db/referrals
- GET/POST /api/db/settings
- POST /api/db/analytics
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import datetime
import os
import json
import threading

app = Flask(__name__)
CORS(app)  # Enable CORS

# Check if data directory exists
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# --- JSON Database Engine ---
class JsonDatabase:
    def __init__(self, filename):
        self.filepath = os.path.join(DATA_DIR, filename)
        self.lock = threading.Lock()
        if not os.path.exists(self.filepath):
            with open(self.filepath, 'w') as f:
                json.dump([], f) if 'settings' not in filename and 'referrals' not in filename else json.dump({}, f)

    def read(self):
        with self.lock:
            try:
                with open(self.filepath, 'r') as f:
                    return json.load(f)
            except:
                return [] if 'settings' not in self.filepath and 'referrals' not in self.filepath else {}

    def write(self, data):
        with self.lock:
            with open(self.filepath, 'w') as f:
                json.dump(data, f, indent=2)

# Initialize DBs
db_users = JsonDatabase('users.json')
db_tournaments = JsonDatabase('tournaments.json')
db_registrations = JsonDatabase('registrations.json')
db_results = JsonDatabase('results.json')
db_wallets = JsonDatabase('wallets.json') # {email: {balance: 0, transactions: []}}
db_withdrawals = JsonDatabase('withdrawals.json')
db_referrals = JsonDatabase('referrals.json') # {email: {code: "HF73J", referredUsers: [], earnings: 0}}
db_settings = JsonDatabase('settings.json')
db_analytics = JsonDatabase('analytics.json')

# --- Helper Functions ---
def get_user_backend(uid):
    """External API Fetch"""
    TIMEOUT = 20
    # Try Backend 1: tsunstudio
    try:
        url = f"https://fffinfo.tsunstudio.pw/get?uid={uid}"
        print(f"[Backend 1] Trying: {url}")
        response = requests.get(url, timeout=TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            account_info = data.get("AccountInfo", {})
            if account_info.get("AccountName"):
                return {
                    "nickname": account_info.get("AccountName"),
                    "level": account_info.get("AccountLevel"),
                    "region": account_info.get("AccountRegion"),
                    "likes": account_info.get("AccountLikes"),
                    "lastLogin": format_last_login(account_info.get("AccountLastLogin", "")),
                }
    except Exception as e:
        print(f"[Backend 1] Failed: {e}")

    # Try Backend 2: Vercel
    regions = ['IND', 'SG', 'PK', 'BD', 'BR', 'ID', 'TW', 'VN', 'TH', 'ME']
    for region in regions:
        try:
            url = f"https://freefire-api-six.vercel.app/get_player_personal_show?server={region}&uid={uid}"
            print(f"[Backend 2] Trying: {url}")
            response = requests.get(url, timeout=TIMEOUT)
            if response.status_code == 200:
                data = response.json()
                if data.get("AccountInfo", {}).get("AccountName"):
                    info = data["AccountInfo"]
                    return {
                        "nickname": info.get("AccountName"),
                        "level": info.get("AccountLevel"),
                        "region": info.get("AccountRegion", region),
                        "likes": info.get("AccountLikes"),
                        "lastLogin": format_last_login(info.get("AccountLastLogin", "")),
                    }
        except:
            continue
    return None

def format_last_login(timestamp_str):
    try:
        timestamp = int(timestamp_str)
        last_login = datetime.datetime.fromtimestamp(timestamp)
        today = datetime.datetime.now()
        diff = today - last_login
        years = diff.days // 365
        months = (diff.days % 365) // 30
        days = (diff.days % 365) % 30
        if years > 0: return f"{years}y {months}m {days}d ago"
        elif months > 0: return f"{months}m {days}d ago"
        else: return f"{days}d ago"
    except: return "Unknown"

# --- DB Endpoints ---

@app.route('/api/db/users', methods=['GET', 'POST'])
def handle_users():
    users = db_users.read()
    if request.method == 'GET':
        email = request.args.get('email')
        if email:
            user = next((u for u in users if u['email'] == email), None)
            return jsonify(user) if user else ('', 404)
        return jsonify(users)
    
    # POST (Register/Update)
    data = request.json
    existing = next((u for u in users if u['email'] == data['email']), None)
    if existing:
        if data.get('password'): # Only error on registration, not update
            # Ideally checking if it's a new registration vs update 
            pass # Simplified: Overwrite or Merge
        users = [u for u in users if u['email'] != data['email']]
    
    users.append(data)
    db_users.write(users)
    return jsonify({"success": True, "user": data})

@app.route('/api/db/tournaments', methods=['GET', 'POST', 'DELETE'])
def handle_tournaments():
    tournaments = db_tournaments.read()
    if request.method == 'GET':
        tid = request.args.get('id')
        if tid:
            t = next((t for t in tournaments if t['id'] == tid), None)
            return jsonify(t) if t else ('', 404)
        return jsonify(tournaments)

    if request.method == 'DELETE':
        tid = request.args.get('id')
        tournaments = [t for t in tournaments if t['id'] != tid]
        db_tournaments.write(tournaments)
        return jsonify({"success": True})

    # POST (Create/Update)
    data = request.json
    tid = data.get('id')
    if tid:
        # Update existing by removing old one first
        tournaments = [t for t in tournaments if t['id'] != tid]
    
    tournaments.append(data)
    # Sort by date usually? Or keep insert order
    db_tournaments.write(tournaments)
    return jsonify({"success": True, "tournament": data})

@app.route('/api/db/registrations', methods=['GET', 'POST'])
def handle_registrations():
    regs = db_registrations.read()
    if request.method == 'GET':
        tid = request.args.get('tournamentId')
        if tid:
            return jsonify([r for r in regs if r['tournamentId'] == tid])
        return jsonify(regs)

    # POST (Join)
    data = request.json
    # Validation: Check if already joined
    exists = any(r for r in regs if r['tournamentId'] == data['tournamentId'] and r['userEmail'] == data['userEmail'])
    if exists:
        return jsonify({"success": False, "error": "Already joined"}), 400
    
    regs.append(data)
    db_registrations.write(regs)
    return jsonify({"success": True})

@app.route('/api/db/results', methods=['GET', 'POST', 'PUT'])
def handle_results():
    results = db_results.read()
    if request.method == 'GET':
        tid = request.args.get('tournamentId')
        if tid:
            return jsonify([r for r in results if r['tournamentId'] == tid])
        return jsonify(results)

    if request.method == 'POST':
        data = request.json
        exists = any(r for r in results if r['tournamentId'] == data['tournamentId'] and r['userEmail'] == data['userEmail'])
        if exists:
            return jsonify({"success": False, "error": "Result already submitted"}), 400
        results.append(data)
        db_results.write(results)
        return jsonify({"success": True})
    
    if request.method == 'PUT':
        # Verify/Update result
        data = request.json
        rid = data.get('id')
        for i, r in enumerate(results):
            if r.get('id') == rid:
                results[i] = {**r, **data}
                break
        db_results.write(results)
        return jsonify({"success": True})

@app.route('/api/db/wallet/<email>', methods=['GET'])
def get_balance(email):
    wallets = db_wallets.read()
    if email not in wallets:
        return jsonify({"balance": 0, "adCoinBalance": 0, "transactions": []})
    return jsonify(wallets[email])

@app.route('/api/db/wallet/transaction', methods=['POST'])
def add_transaction():
    data = request.json
    email = data['email']
    amount = float(data['amount'])
    txn_type = data['type'] # credit/debit
    currency = data.get('currency', 'money') # money (default) or adcoin
    
    wallets = db_wallets.read()
    if email not in wallets:
        wallets[email] = {"balance": 0, "adCoinBalance": 0, "transactions": []}
    
    # Ensure adCoinBalance exists for old users
    if 'adCoinBalance' not in wallets[email]:
        wallets[email]['adCoinBalance'] = 0

    balance_key = 'adCoinBalance' if currency == 'adcoin' else 'balance'

    if txn_type == 'credit':
        wallets[email][balance_key] += amount
    elif txn_type == 'debit':
        if wallets[email][balance_key] < amount:
            return jsonify({"success": False, "error": f"Insufficient {currency} funds"}), 400
        wallets[email][balance_key] -= amount
    
    wallets[email]['transactions'].append(data)
    db_wallets.write(wallets)
    return jsonify({"success": True, "newBalance": wallets[email][balance_key]})

@app.route('/api/db/withdrawals', methods=['GET', 'POST', 'PUT'])
def handle_withdrawals():
    withdrawals = db_withdrawals.read()
    if request.method == 'GET':
        status = request.args.get('status')
        if status:
            return jsonify([w for w in withdrawals if w['status'] == status])
        return jsonify(withdrawals)
        
    if request.method == 'POST':
        data = request.json
        withdrawals.append(data)
        db_withdrawals.write(withdrawals)
        return jsonify({"success": True})

    if request.method == 'PUT':
        data = request.json
        wid = data.get('id')
        for i, w in enumerate(withdrawals):
            if w.get('id') == wid:
                withdrawals[i] = {**w, **data}
                break
        db_withdrawals.write(withdrawals)
        return jsonify({"success": True})

@app.route('/api/db/referrals', methods=['GET', 'POST', 'PUT'])
def handle_referrals():
    refs = db_referrals.read()
    if request.method == 'GET':
        email = request.args.get('email')
        code = request.args.get('code')
        if email:
            return jsonify(refs.get(email, None))
        if code:
            # Find email by code
            found = next((k for k, v in refs.items() if v['code'] == code), None)
            return jsonify({"email": found}) if found else ('', 404)
        return jsonify(refs)

    if request.method == 'POST':
        data = request.json
        email = data['email']
        refs[email] = data['data']
        db_referrals.write(refs)
        return jsonify({"success": True})

    if request.method == 'PUT':
        # Used for updating earnings/referred lists
        data = request.json
        email = data['email']
        if email in refs:
            refs[email] = {**refs[email], **data['updates']}
            db_referrals.write(refs)
        return jsonify({"success": True})

@app.route('/api/db/settings', methods=['GET', 'POST'])
def handle_settings():
    settings = db_settings.read()
    if request.method == 'GET':
        if not settings:
            return jsonify({
                "platformFee": 10,
                "defaultPerKillBonus": 5,
                "currency": "INR",
                "minWithdrawal": 50,
                "referralBonus": 10
            })
        return jsonify(settings)
    
    data = request.json
    db_settings.write(data)
    return jsonify({"success": True})

@app.route('/api/db/analytics', methods=['POST', 'GET'])
def handle_analytics():
    logs = db_analytics.read()
    if request.method == 'GET':
        return jsonify(logs)
    
    data = request.json
    logs.append(data)
    db_analytics.write(logs)
    return jsonify({"success": True})

# --- Player Data API ---
@app.route('/api/player', methods=['GET'])
def get_player():
    uid = request.args.get('uid')
    if not uid or not uid.isdigit():
        return jsonify({"success": False, "error": "Invalid UID"}), 400
    
    print(f"\n[API] Fetching player info for UID: {uid}")
    result = get_user_backend(uid)
    
    if result:
        return jsonify({"success": True, "data": {**result, "uid": uid}}), 200
    
    return jsonify({"success": False, "error": "Could not fetch player data"}), 502

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "mode": "local_json_backend"})

if __name__ == '__main__':
    print("\n🎮 Free Fire Tournament Server (Local Backend)")
    print("=" * 45)
    print("Database: ff_api/data/*.json")
    print("User Data: http://localhost:5000/api/db/users")
    print("=" * 45)
    app.run(debug=True, host='0.0.0.0', port=5000)

