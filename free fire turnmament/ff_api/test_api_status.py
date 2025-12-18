import requests
import time

def test_backends():
    uid = "12345678" # Example UID
    backends = [
        "https://fffinfo.tsunstudio.pw/get?uid={}",
        "https://freefire-api-six.vercel.app/get_player_personal_show?server=IND&uid={}"
    ]
    
    print("🔍 Testing Free Fire API Backends...")
    
    for url in backends:
        target = url.format(uid)
        print(f"\nTarget: {target}")
        try:
            start = time.time()
            response = requests.get(target, timeout=10)
            latency = (time.time() - start) * 1000
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Status: 200 OK (Latency: {latency:.0f}ms)")
                # print(f"Response: {str(data)[:100]}...")
            else:
                print(f"❌ Status: {response.status_code}")
                # print(f"Response: {response.text[:100]}")
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_backends()
