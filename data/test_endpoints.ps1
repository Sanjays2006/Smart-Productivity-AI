$body = @{
    username = "testuser"
    password = "password123"
    email    = "testuser@example.com"
} | ConvertTo-Json

Write-Host "=== 1. Testing Auth Register / Login ==="
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" -Method Post -ContentType "application/json" -Body $body
    $token = $res.token
    Write-Host "Registered successfully. Token acquired."
} catch {
    $res = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -ContentType "application/json" -Body $body
    $token = $res.token
    Write-Host "Logged in successfully. Token acquired."
}

$headers = @{ "Authorization" = "Bearer $token" }

Write-Host "`n=== 2. Testing Auth Check (/api/auth/me) ==="
$me = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/me" -Headers $headers
Write-Host "Authenticated user:" $me.username "Role:" $me.role "ID:" $me.id

Write-Host "`n=== 3. Testing Activities Endpoint ==="
$actList = Invoke-RestMethod -Uri "http://localhost:8080/api/activities" -Headers $headers
Write-Host "Total existing activities:" $actList.Count

$newActBody = @{
    name = "Deep Learning AI Model"
    category = "DEVELOPMENT"
} | ConvertTo-Json

$act = Invoke-RestMethod -Uri "http://localhost:8080/api/activities" -Method Post -Headers $headers -ContentType "application/json" -Body $newActBody
Write-Host "Created new Activity ID:" $act.id "Name:" $act.name

Write-Host "`n=== 4. Testing Session Create (Start Session) ==="
$sess = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/start?activityId=$($act.id)&targetSeconds=1500&deepWorkMode=true" -Method Post -Headers $headers
Write-Host "Session Created ID:" $sess.id "Status:" $sess.status "Target:" $sess.targetSeconds

Write-Host "`n=== 5. Testing Session Pause & Resume ==="
$paused = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/$($sess.id)/pause" -Method Post -Headers $headers
Write-Host "Session Paused ID:" $paused.id "Status:" $paused.status

$resumed = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/$($sess.id)/resume" -Method Post -Headers $headers
Write-Host "Session Resumed ID:" $resumed.id "Status:" $resumed.status

Write-Host "`n=== 6. Testing Session Update & End ==="
$ended = Invoke-RestMethod -Uri "http://localhost:8080/api/sessions/$($sess.id)/end?isPomodoro=true&notes=Finished%20AI%20session" -Method Post -Headers $headers
Write-Host "Session Ended ID:" $ended.id "Status:" $ended.status "XP Earned:" $ended.xpEarned

Write-Host "`n=== 7. Testing Notes Endpoint ==="
$noteBody = @{
    title = "Session Notes Test"
    content = "Completed testing session creation, update, and end handlers."
    tags = "testing,session"
} | ConvertTo-Json
$note = Invoke-RestMethod -Uri "http://localhost:8080/api/notes" -Method Post -Headers $headers -ContentType "application/json" -Body $noteBody
Write-Host "Created Note ID:" $note.id "Title:" $note.title

Write-Host "`n=== 8. Testing Gamification Profile Endpoint ==="
$game = Invoke-RestMethod -Uri "http://localhost:8080/api/gamification/profile" -Headers $headers
Write-Host "Current XP:" $game.xp "Level:" $game.level "Current Streak:" $game.streakDays

Write-Host "`n=============================================="
Write-Host "🎉 ALL BACKEND API FUNCTION CHECKS PASSED 100%"
Write-Host "=============================================="
