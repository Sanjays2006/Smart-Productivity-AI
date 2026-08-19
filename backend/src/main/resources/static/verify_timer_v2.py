import sys
import requests
import json
import random
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8080"
headers = {"Content-Type": "application/json"}

# Generate a unique username for testing
rand_suffix = random.randint(1000, 9999)
username = f"timer_test_user_{rand_suffix}"
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

print("\n--- 2. Creating an Activity ---")
act_payload = {
    "name": "Integration Testing",
    "colorCode": "#3b82f6",
    "icon": "fa-vial",
    "category": "CODING",
    "difficulty": "HARD",
    "estimatedDuration": 35,
    "priority": "HIGH"
}
r_act = requests.post(f"{BASE_URL}/api/activities", json=act_payload, headers=auth_headers)
if r_act.status_code == 200:
    act = r_act.json()
    print("Created Activity successfully:")
    print(json.dumps(act, indent=2))
    assert act.get("id") is not None, "Activity ID is null!"
    assert act.get("category") == "CODING", "Category mismatch!"
    assert act.get("difficulty") == "HARD", "Difficulty mismatch!"
    assert act.get("estimatedDuration") == 35, "Duration mismatch!"
    assert act.get("priority") == "HIGH", "Priority mismatch!"
    assert act.get("icon") == "fa-vial", "Icon mismatch!"
    activity_id = act.get("id")
else:
    print(f"Failed to create activity: {r_act.status_code} - {r_act.text}")
    exit(1)

print("\n--- 3. Starting a Focus Session ---")
start_params = {
    "activityId": activity_id,
    "targetSeconds": 2100,
    "deepWorkMode": True
}
# Start endpoint takes params or body? Let's check: Api.startSession uses query parameters
r_start = requests.post(f"{BASE_URL}/api/sessions/start", params=start_params, headers=auth_headers)
if r_start.status_code == 200:
    session = r_start.json()
    print("Session started successfully:")
    print(json.dumps(session, indent=2))
    assert session.get("id") is not None, "Session ID is null!"
    assert session.get("status") == "ACTIVE", "Session status is not ACTIVE!"
    assert session.get("targetSeconds") == 2100, "Session targetSeconds mismatch!"
    assert session.get("deepWorkMode") is True, "Session deepWorkMode mismatch!"
    session_id = session.get("id")
else:
    print(f"Failed to start session: {r_start.status_code} - {r_start.text}")
    exit(1)

print("\n--- 4. Pausing the Session ---")
r_pause = requests.post(f"{BASE_URL}/api/sessions/{session_id}/pause", headers=auth_headers)
if r_pause.status_code == 200:
    paused_session = r_pause.json()
    print("Session paused successfully:")
    print(json.dumps(paused_session, indent=2))
    assert paused_session.get("status") == "PAUSED", "Session status is not PAUSED!"
    assert paused_session.get("pauseCount") == 1, "Pause count should be 1!"
else:
    print(f"Failed to pause session: {r_pause.status_code} - {r_pause.text}")
    exit(1)

print("\n--- 5. Resuming the Session ---")
r_resume = requests.post(f"{BASE_URL}/api/sessions/{session_id}/resume", headers=auth_headers)
if r_resume.status_code == 200:
    resumed_session = r_resume.json()
    print("Session resumed successfully:")
    print(json.dumps(resumed_session, indent=2))
    assert resumed_session.get("status") == "ACTIVE", "Session status is not ACTIVE after resume!"
else:
    print(f"Failed to resume session: {r_resume.status_code} - {r_resume.text}")
    exit(1)

print("\n--- 6. Ending and Saving the Session ---")
end_params = {
    "isPomodoro": True,
    "notes": "Verified API functionality end-to-end with validation script."
}
r_end = requests.post(f"{BASE_URL}/api/sessions/{session_id}/end", params=end_params, headers=auth_headers)
if r_end.status_code == 200:
    ended_session = r_end.json()
    print("Session ended and saved successfully:")
    print(json.dumps(ended_session, indent=2))
    assert ended_session.get("status") == "COMPLETED", "Session status is not COMPLETED!"
    assert ended_session.get("earnedXp") > 0, "Earned XP should be greater than 0!"
    assert ended_session.get("focusScore") is not None, "Focus score is null!"
    print(f"Earned XP: {ended_session.get('earnedXp')}, Focus Score: {ended_session.get('focusScore')}")
else:
    print(f"Failed to end session: {r_end.status_code} - {r_end.text}")
    exit(1)

print("\n--- 7. Fetching Timer Analytics ---")
r_analytics = requests.get(f"{BASE_URL}/api/sessions/analytics", headers=auth_headers)
if r_analytics.status_code == 200:
    analytics = r_analytics.json()
    print("Fetched analytics successfully:")
    print(json.dumps(analytics, indent=2))
    assert analytics.get("completedSessionsCount") == 1, "Completed sessions count mismatch!"
    assert analytics.get("focusTimeTodayMinutes") is not None, "focusTimeTodayMinutes is missing!"
    assert analytics.get("weeklyFocusHours") is not None, "weeklyFocusHours is missing!"
    assert analytics.get("averageSessionLengthMinutes") is not None, "averageSessionLengthMinutes is missing!"
    assert "CODING" in analytics.get("categoryDistribution", {}), "Category CODING not found in distribution!"
    assert len(analytics.get("weeklyFocusTrend", {})) > 0, "weeklyFocusTrend is empty!"
    assert analytics.get("aiRecommendation") is not None, "AI Recommendation is missing!"
else:
    print(f"Failed to fetch analytics: {r_analytics.status_code} - {r_analytics.text}")
    exit(1)

print("\n--- 8. Fetching Timeline logs ---")
r_history = requests.get(f"{BASE_URL}/api/history/sessions", headers=auth_headers)
if r_history.status_code == 200:
    history = r_history.json()
    print(f"History sessions found: {len(history)}")
    print(json.dumps(history[0], indent=2))
    assert len(history) == 1, "History list size should be 1!"
    assert history[0].get("id") == session_id, "History session ID mismatch!"
else:
    print(f"Failed to fetch history: {r_history.status_code} - {r_history.text}")
    exit(1)

print("\n--- Deep Work System API Verification Successful! ---")
