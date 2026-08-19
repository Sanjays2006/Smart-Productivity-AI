import sys
import requests
sys.stdout.reconfigure(encoding='utf-8')
import json
import random

BASE_URL = "http://localhost:8080"
headers = {"Content-Type": "application/json"}

# Generate a unique username for testing
rand_suffix = random.randint(1000, 9999)
username = f"test_dash_user_{rand_suffix}"
password = "supersecretpassword123"

print(f"--- 1. Registering user: {username} ---")
reg_payload = {
    "username": username,
    "email": f"{username}@example.com",
    "password": password
}
r = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload, headers=headers)
if r.status_code != 200:
    print(f"Registration failed: {r.status_code} - {r.text}")
    exit(1)

reg_data = r.json()
token = reg_data.get("token")
print(f"Token obtained successfully: Bearer {token[:15]}...")

auth_headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}

print("\n--- 2. Fetching default preferences ---")
r_pref = requests.get(f"{BASE_URL}/api/user/preferences", headers=auth_headers)
if r_pref.status_code == 200:
    prefs = r_pref.json()
    print("Default Preferences:")
    print(json.dumps(prefs, indent=2))
else:
    print(f"Failed to fetch preferences: {r_pref.status_code} - {r_pref.text}")
    exit(1)

print("\n--- 3. Updating dailyFocusGoal to 3 hours (10800 seconds) ---")
update_payload = {"dailyFocusGoal": 10800, "selectedTopics": "Java Concurrency,Spring Boot Security"}
r_update = requests.post(f"{BASE_URL}/api/user/preferences", json=update_payload, headers=auth_headers)
if r_update.status_code == 200:
    res = r_update.json()
    print("Update Response:")
    print(json.dumps(res, indent=2))
else:
    print(f"Failed to update preferences: {r_update.status_code} - {r_update.text}")
    exit(1)

print("\n--- 4. Fetching Dashboard data & validating dynamic briefing and goal ---")
r_dash = requests.get(f"{BASE_URL}/api/dashboard", headers=auth_headers)
if r_dash.status_code == 200:
    dash = r_dash.json()
    print(f"Returned dailyFocusGoal: {dash.get('dailyFocusGoal')}")
    print("\nFull dashboard payload:")
    print(json.dumps(dash, indent=2))
    briefing = dash.get("briefing")
    print("Daily Briefing from PostgreSQL:")
    print(json.dumps(briefing, indent=2))
    
    assert dash.get("dailyFocusGoal") == 10800, "Error: dailyFocusGoal mismatch!"
    assert briefing is not None, "Error: briefing object missing!"
    print("[OK] Dashboard dynamic validation successful!")
else:
    print(f"Failed to fetch dashboard: {r_dash.status_code} - {r_dash.text}")
    exit(1)

print("\n--- 5. Logging some focus sessions and AI conversations to test Recall ---")
# Log a focus session
r_track1 = requests.post(f"{BASE_URL}/api/activity/track", json={
    "category": "TIMER",
    "action": "TIMER_END",
    "description": "Completed study session on Java Concurrency",
    "metadata": "duration_seconds=3600",
    "relatedRecordId": "1"
}, headers=auth_headers)
print(f"Logged Focus Session Activity: {r_track1.status_code}")

# Log a chat
r_track2 = requests.post(f"{BASE_URL}/api/activity/track", json={
    "category": "CHAT",
    "action": "PROMPT_SEND",
    "description": "Asked AI: What is a thread pool executor in Java?",
    "metadata": "rag-ask",
    "relatedRecordId": "2"
}, headers=auth_headers)
print(f"Logged Chat Activity: {r_track2.status_code}")

# Trigger actual RAG save
requests.post(f"{BASE_URL}/api/ai/ask", json={
    "question": "What is a thread pool executor in Java?",
    "mode": "hybrid"
}, headers=auth_headers)

print("\n--- 6. Running targeted recall queries on the Memory API ---")
recall_queries = [
    "What did I work on yesterday?",
    "Show my recent AI conversations.",
    "Summarize my productivity trends.",
    "Show my study activity for the last 7 days.",
    "What documents did I upload recently?"
]

for query in recall_queries:
    print(f"\nQuerying: '{query}'")
    ask_payload = {
        "question": query,
        "mode": "hybrid"
    }
    r_ask = requests.post(f"{BASE_URL}/api/ai/ask", json=ask_payload, headers=auth_headers)
    if r_ask.status_code == 200:
        data = r_ask.json()
        print(f"Answer (Model: {data.get('model')}):")
        answer = data.get("answer")
        try:
            print(answer)
        except UnicodeEncodeError:
            print(answer.encode('utf-8', errors='replace').decode('utf-8'))
    else:
        print(f"Ask endpoint failed: {r_ask.status_code} - {r_ask.text}")

print("\n--- All tests completed successfully! ---")
