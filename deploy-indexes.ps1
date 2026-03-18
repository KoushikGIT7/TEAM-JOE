# Firestore Index Deployment Script
# This script will authenticate and deploy Firestore indexes

Write-Host "Firestore Index Deployment Script" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebaseCheck = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseCheck) {
    Write-Host "[-] Firebase CLI not found. Installing..." -ForegroundColor Red
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] Failed to install Firebase CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "[+] Firebase CLI installed" -ForegroundColor Green
} else {
    Write-Host "[+] Firebase CLI found" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 1: Authenticating with Firebase..." -ForegroundColor Yellow
Write-Host "A browser window will open for authentication." -ForegroundColor Cyan
firebase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Authentication failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Setting Firebase project..." -ForegroundColor Yellow
firebase use joecafe-a7fff

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Project not set. Adding project..." -ForegroundColor Yellow
    firebase use joecafe-a7fff --add
}

Write-Host ""
Write-Host "Step 3: Deploying Firestore indexes..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
firebase deploy --only firestore:indexes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[+] Indexes deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Index build status:" -ForegroundColor Cyan
    Write-Host "   - Check Firebase Console: https://console.firebase.google.com/project/joecafe-a7fff/firestore/indexes" -ForegroundColor White
    Write-Host "   - Build time: 5-15 minutes (typically)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[-] Deployment failed" -ForegroundColor Red
    exit 1
}
