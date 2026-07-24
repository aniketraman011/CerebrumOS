# CerebrumOS Setup and Run Script
# This script sets up the environment and runs both backend and frontend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CerebrumOS Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "[1/5] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = py --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.10+ from python.org" -ForegroundColor Red
    exit 1
}

# Check Node.js
Write-Host "[2/5] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 24+ from nodejs.org" -ForegroundColor Red
    exit 1
}

# Setup Backend
Write-Host "[3/5] Setting up Python backend..." -ForegroundColor Yellow
Set-Location backend

# Check if virtual environment exists
if (-Not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    py -m venv .venv
}

# Activate virtual environment and install dependencies
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& .\.venv\Scripts\Activate.ps1

Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
py -m pip install --upgrade pip --quiet
py -m pip install fastapi uvicorn pydantic sqlalchemy websockets --quiet

Write-Host "✓ Backend setup complete" -ForegroundColor Green
Set-Location ..

# Setup Frontend
Write-Host "[4/5] Setting up Next.js frontend..." -ForegroundColor Yellow
Set-Location frontend

if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing Node.js dependencies (this may take a few minutes)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Frontend dependency installation failed" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
} else {
    Write-Host "✓ Node modules already installed" -ForegroundColor Green
}

Write-Host "✓ Frontend setup complete" -ForegroundColor Green
Set-Location ..

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run the project:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 (Backend):" -ForegroundColor Cyan
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  py main.py" -ForegroundColor White
Write-Host ""
Write-Host "Terminal 2 (Frontend):" -ForegroundColor Cyan
Write-Host "  cd frontend" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend API: http://localhost:8000" -ForegroundColor Green
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
