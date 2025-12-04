# PowerShell script to regenerate recommendations with fixed ML service

Write-Host "🔄 Regenerating recommendations with fixed ML service..." -ForegroundColor Cyan
Write-Host ""

# Site ID for demo user
$siteId = "380974d5-8040-43a6-9c00-fac5e57f55f4"

# Check if ML service is running
Write-Host "1️⃣  Checking ML service status..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -ErrorAction Stop
    Write-Host "   ✅ ML service is running" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ ML service is not running!" -ForegroundColor Red
    Write-Host "   Please start it with:" -ForegroundColor Yellow
    Write-Host "   cd ml-service" -ForegroundColor White
    Write-Host '   & "..\venv\Scripts\python.exe" -m app.main' -ForegroundColor White
    Write-Host ""
    exit 1
}

# Note about restarting ML service
Write-Host "⚠️  IMPORTANT: The ML service code has been updated." -ForegroundColor Yellow
Write-Host "   If you haven't restarted it since the carbon intensity fix," -ForegroundColor Yellow
Write-Host "   please restart the ML service to load the updated code." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Press any key to continue, or Ctrl+C to cancel and restart ML service first..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""

# Generate recommendations
Write-Host "2️⃣  Generating new recommendations..." -ForegroundColor Yellow

$body = @{
    site_id = $siteId
    forecast_hours = 24
    training_days = 7
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/recommend/generate" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop

    Write-Host "   ✅ Recommendations generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "   Recommendations created: $($response.recommendations_saved)" -ForegroundColor White
    Write-Host "   Forecasts saved: $($response.forecasts_saved)" -ForegroundColor White
    Write-Host "   Weather forecasts: $($response.weather_forecasts_saved)" -ForegroundColor White
    Write-Host ""

    # Display recommendations
    if ($response.recommendations -and $response.recommendations.Count -gt 0) {
        Write-Host "✨ Generated Recommendations:" -ForegroundColor Cyan
        foreach ($rec in $response.recommendations) {
            Write-Host ""
            Write-Host "   Type: $($rec.type)" -ForegroundColor Yellow
            Write-Host "   Headline: $($rec.headline)" -ForegroundColor White
            Write-Host "   Cost Savings: `$$($rec.cost_savings)" -ForegroundColor Green
            Write-Host "   CO2 Reduction: $($rec.co2_reduction) kg" -ForegroundColor Green
            Write-Host "   Confidence: $($rec.confidence)%" -ForegroundColor White
        }
        Write-Host ""
    }

} catch {
    Write-Host "   ❌ Error generating recommendations:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "✅ Done! Refresh your dashboard at http://localhost:3000" -ForegroundColor Green
Write-Host ""
