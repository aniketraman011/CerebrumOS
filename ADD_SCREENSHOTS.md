# How to Add Screenshots to README

## Step 1: Rename Your Screenshots

You have 15 screenshots. Rename them with these exact names and copy them to `docs/images/` folder:

1. **playground.png** - The main Runtime Playground dashboard (first image you showed)
2. **pipeline.png** - Active request pipeline visualization (second image)
3. **workers-memory.png** - Thread pool and memory metrics (third image)
4. **timeline.png** - Timeline Replay interface (fifth image)
5. **job-details.png** - Job lifecycle details modal (fourth image)
6. **decision-engine.png** - Decision Engine with interview mode (sixth image)
7. **memory-viz.png** - Memory Visualization with heat map (seventh image)
8. **cache-dashboard.png** - Radix Cache dashboard (eighth image)
9. **aitop.png** - AI-Top system telemetry (ninth image)
10. **benchmarks.png** - Benchmark comparison charts (tenth image)
11. **architecture.png** - Interactive system architecture (eleventh image)
12. **algorithms.png** - Algorithm visualizer (twelfth image)
13. **historical-metrics.png** - Historical metrics trends (thirteenth image)
14. **settings.png** - Cluster settings UI (fourteenth image)
15. **logs.png** - System logs viewer (fifteenth image)

## Step 2: Copy Images

Using File Explorer or Command:

```powershell
# Option 1: Using File Explorer
# 1. Navigate to your Downloads folder
# 2. Rename the 15 images according to the list above
# 3. Copy all images to: C:\Users\anike\OneDrive\Desktop\CerebrumOS-main\docs\images\

# Option 2: Using PowerShell (if images are in Downloads)
$imagePath = "$env:USERPROFILE\Downloads"
$targetPath = ".\docs\images"

# Copy and rename (adjust source names as needed)
Copy-Item "$imagePath\Screenshot1.png" "$targetPath\playground.png"
Copy-Item "$imagePath\Screenshot2.png" "$targetPath\pipeline.png"
# ... continue for all 15 images
```

## Step 3: Verify

After copying, check that all images are in place:

```powershell
Get-ChildItem .\docs\images\*.png | Select-Object Name
```

You should see all 15 PNG files listed.

## Quick Copy Command

If your images are named image(1).png through image(15).png in Downloads:

```powershell
# Execute this from project root
$downloads = "$env:USERPROFILE\Downloads"
$target = ".\docs\images"

$names = @(
    "playground", "pipeline", "workers-memory", "timeline", "job-details",
    "decision-engine", "memory-viz", "cache-dashboard", "aitop", "benchmarks",
    "architecture", "algorithms", "historical-metrics", "settings", "logs"
)

for ($i = 1; $i -le 15; $i++) {
    $source = "$downloads\image($i).png"
    if (Test-Path $source) {
        Copy-Item $source "$target\$($names[$i-1]).png"
        Write-Host "✓ Copied image($i).png -> $($names[$i-1]).png"
    }
}
```

## After Adding Images

1. Delete this file: `ADD_SCREENSHOTS.md`
2. Delete `README_SUMMARY.md` if it exists
3. Delete `docs/images/README.md`
4. Commit to Git
