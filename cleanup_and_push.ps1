# CerebrumOS - Cleanup and Push to Git
# Run this script after adding your screenshots

Write-Host "🧹 CerebrumOS Cleanup and Git Push Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check for screenshots
Write-Host "📸 Step 1: Checking for screenshots..." -ForegroundColor Yellow
$imageCount = (Get-ChildItem ".\docs\images\*.png" -ErrorAction SilentlyContinue).Count
if ($imageCount -eq 15) {
    Write-Host "✓ Found all 15 screenshots" -ForegroundColor Green
} else {
    Write-Host "⚠ Warning: Expected 15 images, found $imageCount" -ForegroundColor Yellow
    Write-Host "  Please add your screenshots first using ADD_SCREENSHOTS.md guide" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

Write-Host ""

# Step 2: Clean up temporary files
Write-Host "🗑 Step 2: Removing temporary files..." -ForegroundColor Yellow

$filesToDelete = @(
    ".\README_SUMMARY.md",
    ".\ADD_SCREENSHOTS.md",
    ".\docs\images\README.md",
    ".\cleanup_and_push.ps1"
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  ✓ Deleted: $file" -ForegroundColor Green
    }
}

Write-Host ""

# Step 3: Git status check
Write-Host "📊 Step 3: Checking Git status..." -ForegroundColor Yellow
git status --short

Write-Host ""

# Step 4: Stage changes
Write-Host "➕ Step 4: Staging changes..." -ForegroundColor Yellow
git add README.md
git add docs/
git add .gitignore

$status = git status --short
if ($status) {
    Write-Host "✓ Staged changes:" -ForegroundColor Green
    git status --short
} else {
    Write-Host "⚠ No changes to commit" -ForegroundColor Yellow
    exit
}

Write-Host ""

# Step 5: Commit
Write-Host "💾 Step 5: Committing changes..." -ForegroundColor Yellow
$commitMessage = "docs: add comprehensive README with architecture docs and screenshots

- Add production-quality README.md with full documentation
- Include project overview, features, and tech stack
- Add complete installation and deployment guides
- Include 15 screenshots showcasing all features
- Add environment variables configuration
- Document API endpoints and database schema
- Include security and performance optimization sections
- Add contributing guidelines and future roadmap"

git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Changes committed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Commit failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Push to remote
Write-Host "☁ Step 6: Pushing to remote repository..." -ForegroundColor Yellow
Write-Host "  Remote: $(git remote get-url origin)" -ForegroundColor Cyan

$push = Read-Host "Push to GitHub now? (y/n)"
if ($push -eq "y") {
    $branch = git branch --show-current
    Write-Host "  Pushing to branch: $branch" -ForegroundColor Cyan
    
    git push origin $branch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 All done! Your README is now live on GitHub!" -ForegroundColor Green
    } else {
        Write-Host "✗ Push failed. Please check your credentials and network connection." -ForegroundColor Red
        Write-Host "  You can manually push later with: git push origin $branch" -ForegroundColor Yellow
    }
} else {
    Write-Host "⏸ Skipped push. You can manually push later with:" -ForegroundColor Yellow
    Write-Host "  git push origin $(git branch --show-current)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✨ Cleanup complete!" -ForegroundColor Green
