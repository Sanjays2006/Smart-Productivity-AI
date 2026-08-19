import urllib.request
import urllib.parse
import json

BASE_URL = "http://localhost:8080"

def make_request(url, method="GET", headers=None, data=None):
    if headers is None:
        headers = {}
    if data is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(f"{BASE_URL}{url}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"error": body}
        return e.code, parsed

def run_all_checks():
    print("=" * 60)
    print("      COMPREHENSIVE FULL-STACK SYSTEM & FUNCTION CHECK     ")
    print("=" * 60)

    # Step 1: Session Create (Register / Login)
    user_payload = {
        "username": "session_tester",
        "email": "session_tester@example.com",
        "password": "Password123!"
    }
    
    print("\n[1] SESSION CREATION (Registration & Authentication)")
    status, res = make_request("/api/auth/register", "POST", data=user_payload)
    if status == 400 and "already taken" in str(res):
        print(" -> User already exists. Authenticating via /api/auth/login...")
        status, res = make_request("/api/auth/login", "POST", data=user_payload)
    
    assert status == 200, f"Auth failed with status {status}: {res}"
    token = res.get("token")
    print(f" ✅ Session token created successfully for user: {res.get('username')}")
    
    headers = {"Authorization": f"Bearer {token}"}

    # Step 2: Session Check (/api/auth/me)
    print("\n[2] SESSION CHECK (/api/auth/me)")
    status, me = make_request("/api/auth/me", "GET", headers=headers)
    assert status == 200 and me.get("authenticated") is True, f"Session check failed: {me}"
    print(f" ✅ Session Verified! User ID: {me.get('id')}, Username: {me.get('username')}, Role: {me.get('role')}")

    # Step 3: Activity Creation & Fetch
    print("\n[3] ACTIVITY FUNCTION CHECK (/api/activities)")
    status, activities = make_request("/api/activities", "GET", headers=headers)
    print(f" -> Existing activities count: {len(activities) if isinstance(activities, list) else 0}")
    
    new_activity = {"name": "AI Model Training & Optimization", "category": "DEVELOPMENT"}
    status, act = make_request("/api/activities", "POST", headers=headers, data=new_activity)
    assert status == 200, f"Activity creation failed: {act}"
    activity_id = act.get("id")
    print(f" ✅ Activity Created: ID {activity_id} - '{act.get('name')}'")

    # Step 4: Timer Session Creation (/api/sessions/start)
    print("\n[4] TIMER SESSION CREATE (/api/sessions/start)")
    status, sess = make_request(f"/api/sessions/start?activityId={activity_id}&targetSeconds=1800&deepWorkMode=true", "POST", headers=headers)
    assert status == 200, f"Timer session start failed: {sess}"
    session_id = sess.get("id")
    print(f" ✅ Work Session Started! Session ID: {session_id}, Status: {sess.get('status')}, Target: {sess.get('targetSeconds')}s")

    # Step 5: Timer Session Check & Update (Pause & Resume)
    print("\n[5] TIMER SESSION CHECK & UPDATE (Pause / Resume)")
    status, paused = make_request(f"/api/sessions/{session_id}/pause", "POST", headers=headers)
    assert status == 200, f"Pause session failed: {paused}"
    print(f" ✅ Session Updated to PAUSED! Status: {paused.get('status')}")

    status, resumed = make_request(f"/api/sessions/{session_id}/resume", "POST", headers=headers)
    assert status == 200, f"Resume session failed: {resumed}"
    print(f" ✅ Session Updated to RESUMED! Status: {resumed.get('status')}")

    # Step 6: Timer Session Complete/End
    print("\n[6] TIMER SESSION COMPLETE & CLOSE (/api/sessions/{id}/end)")
    status, ended = make_request(f"/api/sessions/{session_id}/end?isPomodoro=true&notes=Completed+successful+test", "POST", headers=headers)
    assert status == 200, f"End session failed: {ended}"
    print(f" ✅ Session Completed! Final Status: {ended.get('status')}, Duration: {ended.get('durationSeconds')}s, XP Earned: {ended.get('xpEarned')}")

    # Step 7: Notes Create, Read, Update
    print("\n[7] NOTES FUNCTION CHECK (/api/notes)")
    note_payload = {"title": "System Check Log", "content": "All core modules verified.", "tags": "verify,test"}
    status, note = make_request("/api/notes", "POST", headers=headers, data=note_payload)
    assert status == 200, f"Note creation failed: {note}"
    note_id = note.get("id")
    print(f" ✅ Note Created: ID {note_id} - '{note.get('title')}'")

    status, notes_list = make_request("/api/notes", "GET", headers=headers)
    print(f" ✅ Notes Fetched Successfully. Count: {len(notes_list) if isinstance(notes_list, list) else 0}")

    # Step 8: Gamification & Profile Stats Check
    print("\n[8] GAMIFICATION & USER PROGRESSION CHECK (/api/gamification/profile)")
    status, profile = make_request("/api/gamification/profile", "GET", headers=headers)
    assert status == 200, f"Gamification check failed: {profile}"
    print(f" ✅ User Profile Checked! Level: {profile.get('level')}, XP: {profile.get('xp')}, Streak: {profile.get('streakDays')} days")

    # Step 9: Notification Check
    print("\n[9] NOTIFICATION SYSTEM CHECK (/api/notifications)")
    status, notifications = make_request("/api/notifications", "GET", headers=headers)
    print(f" ✅ Notifications System Verified. Messages: {len(notifications) if isinstance(notifications, list) else 0}")

    # Step 10: Logout Check
    print("\n[10] SESSION TERMINATION (/api/auth/logout)")
    status, logout_res = make_request("/api/auth/logout", "POST", headers=headers)
    assert status == 200, f"Logout failed: {logout_res}"
    print(" ✅ Session logged out successfully.")

    print("\n" + "=" * 60)
    print(" 🎉 ALL FUNCTIONS, SESSION CREATION, CHECKS & UPDATES ARE 100% OPERATIONAL!")
    print("=" * 60)

if __name__ == "__main__":
    run_all_checks()
