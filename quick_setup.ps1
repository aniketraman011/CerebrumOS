# Quick Setup Script for CerebrumOS
# This script will guide you through the entire setup process

param(
    [string]$GitHubUsername = "",
    [switch]$SkipScreenshots
)

Write-Host "🧠 CerebrumOS - Quick Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check for screenshots
if (-not $SkipScreenshots) {
    Write-Host "📸 Checking for screenshots..." -ForegroundColor Yellow
    $imageCount = (Get-ChildItem ".\docs\images\*.png" -ErrorAction SilentlyContinue).Count
    
    if ($imageCount -lt 15) {
        Write-Host "⚠ Found only $imageCount/15 screenshots" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please add your screenshots first:" -ForegroundColor White
        Write-Host "  1. Check ADD_SCREENSHOTS.md for instructions" -ForegroundColor White
        Write-Host "  2. Or run: .\quick_setup.ps1 -SkipScreenshots to continue anyway" -ForegroundColor White
        Write-Host ""
        exit
    }
    
    Write-Host "✓ Found all 15 screenshots" -ForegroundColor Green
}

Write-Host ""

# Initialize Git if needed
if (-not (Test-Path ".git")) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
}

Write-Host ""

# Get GitHub username
if (-not $GitHubUsername) {
    Write-Host "Please enter your GitHub username:" -ForegroundColor Cyan
    $GitHubUsername = Read-Host "GitHub username"
}

if (-not $GitHubUsername) {
    Write-Host "✗ GitHub username is required" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "✓ Using GitHub username: $GitHubUsername" -ForegroundColor Green
Write-Host ""

# Stage and commit
Write-Host "📝 Staging changes..." -ForegroundColor Yellow
git add .

Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
git commit -m "feat: initial commit with comprehensive documentation

- Add complete CerebrumOS implementation (backend + frontend + C++)
- Include production-quality README with architecture docs
- Add comprehensive screenshots showcasing all features
- Include Docker deployment configuration
- Add complete documentation (HLD, LLD, designs)
- Implement 5 scheduling policies (FCFS, RR, Priority, MLFQ, Adaptive)
- Add paged memory management with LRU eviction
- Include LRU/LFU response cache
- Add real-time telemetry and benchmark dashboard"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Commit failed" -ForegroundColor Red
    exit
}

Write-Host "✓ Initial commit created" -ForegroundColor Green
Write-Host ""

# Set up remote
Write-Host "🌐 Setting up GitHub remote..." -ForegroundColor Yellow
$remoteUrl = "https://github.com/$GitHubUsername/CerebrumOS.git"

$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "⚠ Remote 'origin' already exists: $existingRemote" -ForegroundColor Yellow
    $overwrite = Read-Host "Replace it with $remoteUrl? (y/n)"
    if ($overwrite -eq "y") {
        git remote remove origin
        git remote add origin $remoteUrl
    }
} else {
    git remote add origin $remoteUrl
}

Write-Host "✓ Remote configured: $remoteUrl" -ForegroundColor Green
Write-Host ""

# Ensure we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "📌 Renaming branch to 'main'..." -ForegroundColor Yellow
    git branch -M main
    Write-Host "✓ Branch renamed to 'main'" -ForegroundColor Green
}

Write-Host ""

# Push to GitHub
Write-Host "☁ Ready to push to GitHub!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: https://github.com/$GitHubUsername/CerebrumOS" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Create the repository on GitHub first!" -ForegroundColor Yellow
Write-Host "  1. Go to: https://github.com/new" -ForegroundColor White
Write-Host "  2. Repository name: CerebrumOS" -ForegroundColor White
Write-Host "  3. Make it PUBLIC" -ForegroundColor White
Write-Host "  4. DO NOT initialize with README" -ForegroundColor White
Write-Host "  5. Click 'Create repository'" -ForegroundColor White
Write-Host ""

$push = Read-Host "Push to GitHub now? (y/n)"

if ($push -eq "y") {
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
    git push -u origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Cyan
        Write-Host "✨ SUCCESS! Your code is now on GitHub!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "View your repo: https://github.com/$GitHubUsername/CerebrumOS" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Add GitHub topics in repo settings" -ForegroundColor White
        Write-Host "  2. Update README.md author section with your links" -ForegroundColor White
        Write-Host "  3. Star your own repo ⭐" -ForegroundColor White
        Write-Host "  4. Share on LinkedIn/Twitter" -ForegroundColor White
        Write-Host ""
        
        # Clean up helper files
        Write-Host "🗑 Cleaning up setup files..." -ForegroundColor Yellow
        $filesToDelete = @(
            ".\ADD_SCREENSHOTS.md",
            ".\COMPLETE_SETUP_GUIDE.md",
            ".\cleanup_and_push.ps1",
            ".\quick_setup.ps1",
            ".\docs\images\README.md"
        )
        
        foreach ($file in $filesToDelete) {
            if (Test-Path $file) {
                Remove-Item $file -Force
                Write-Host "  ✓ Deleted: $file" -ForegroundColor Green
            }
        }
        
        git add .
        git commit -m "chore: remove setup helper files"
        git push
        
        Write-Host ""
        Write-Host "🎉 All done! Your repository is clean and ready!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Push failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "  1. Repository doesn't exist on GitHub - create it first" -ForegroundColor White
        Write-Host "  2. Need authentication - use Personal Access Token" -ForegroundColor White
        Write-Host "  3. Branch protection - check repository settings" -ForegroundColor White
        Write-Host ""
        Write-Host "You can try again later with:" -ForegroundColor Cyan
        Write-Host "  git push -u origin main" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "⏸ Push skipped" -ForegroundColor Yellow
    Write-Host "When ready, run: git push -u origin main" -ForegroundColor Cyan
}
