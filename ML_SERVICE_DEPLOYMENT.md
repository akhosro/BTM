# ML Service Deployment Guide

## 🎯 Goal
Deploy your Python ML service (Prophet forecasting + recommendations) to production.

---

## 🤔 Quick Decision: Choose Your Platform

### Option 1: Railway ⭐ RECOMMENDED
**Why Railway:**
- ✅ Easiest Python deployment
- ✅ Free $5 credit/month (enough for testing)
- ✅ Auto-deploy from GitHub
- ✅ Built-in logs and monitoring
- ✅ Custom domains included
- ✅ Great for monorepo (can host Next.js + ML together)

**Cost**: $5-15/month
**Setup time**: 10 minutes

---

### Option 2: Render
**Why Render:**
- ✅ Free tier available (with sleep)
- ✅ Easy Docker deployment
- ✅ Good documentation
- ✅ Auto-scaling available

**Cost**: $0 (free with sleep) or $7/month (always on)
**Setup time**: 15 minutes

---

### Option 3: AWS ECS (Advanced)
**Why AWS:**
- ✅ Most scalable
- ✅ Best for production at scale
- ✅ Full control

**Cost**: $20-50/month
**Setup time**: 1-2 hours
**Difficulty**: Advanced

---

## 🚀 Railway Deployment (RECOMMENDED)

### Prerequisites
- GitHub account
- Your code pushed to GitHub
- Supabase connection string (you have this!)

---

### Step 1: Prepare ML Service for Deployment (5 min)

First, let's create necessary deployment files:

#### 1.1 Create `railway.json`

Create this file in your project root (`enalysis-mvp/railway.json`):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ml-service && pip install --no-cache-dir -r requirements.txt"
  },
  "deploy": {
    "startCommand": "cd ml-service && python -m app.main",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### 1.2 Create `nixpacks.toml`

Create this in `ml-service/nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ['python311', 'gcc', 'postgresql']

[phases.install]
cmds = ['pip install --no-cache-dir -r requirements.txt']

[start]
cmd = 'python -m app.main'
```

#### 1.3 Verify `requirements.txt`

Make sure `ml-service/requirements.txt` exists with all dependencies:

```txt
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
prophet>=1.1.5
pandas>=2.1.0
numpy>=1.26.0
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
requests>=2.31.0
```

---

### Step 2: Push to GitHub (If Not Already)

```bash
# Initialize git if needed
cd enalysis-mvp
git init

# Add files
git add .

# Commit (secrets are protected by .gitignore!)
git commit -m "Prepare for Railway deployment"

# Create GitHub repo and push
# Follow GitHub's instructions to create a new repository
git remote add origin https://github.com/YOUR_USERNAME/enalysis-mvp.git
git branch -M main
git push -u origin main
```

---

### Step 3: Deploy to Railway (10 min)

#### 3.1 Sign Up for Railway

1. **Go to**: https://railway.app
2. **Click**: "Login" → "Login with GitHub"
3. **Authorize**: Railway app

#### 3.2 Create New Project

1. **Click**: "New Project"
2. **Select**: "Deploy from GitHub repo"
3. **Choose**: Your `enalysis-mvp` repository
4. **Railway will**: Auto-detect it's a monorepo

#### 3.3 Configure Service

1. **Click**: "Add variables" or go to Variables tab
2. **Add these environment variables**:

```bash
# Database (use your Supabase URL)
DATABASE_URL=postgresql://postgres:6495424Ari%21@db.lccbpaopmruxdvfkdoor.supabase.co:5432/postgres?sslmode=require

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=info

# Model cache
MODEL_CACHE_DIR=./models/cache

# Weather API (optional but recommended)
OPENWEATHER_API_KEY=a53902175c3eced21bcd3ac813d4c9ba

# Python
PYTHONUNBUFFERED=1
```

3. **Click**: "Deploy"

#### 3.4 Wait for Deployment

- Railway will build your service (2-3 minutes)
- Watch the logs for any errors
- Look for: `Uvicorn running on http://0.0.0.0:8000`

#### 3.5 Get Your Service URL

1. **Go to**: Settings tab
2. **Click**: "Generate Domain" under Networking
3. **Copy** your URL: `https://your-app.railway.app`
4. **Save** this URL - you'll need it!

---

### Step 4: Test the Deployment

```bash
# Test health endpoint
curl https://your-app.railway.app/health

# Expected response:
# {"status":"healthy","timestamp":"2025-12-04T..."}

# Test recommendation generation
curl -X POST https://your-app.railway.app/api/recommend/generate \
  -H "Content-Type: application/json" \
  -d '{"site_id": "YOUR_SITE_ID", "forecast_hours": 24, "training_days": 7}'
```

---

### Step 5: Update Main App

Update your Next.js app's environment variable:

**Local (`.env.local`)**:
```bash
ML_SERVICE_URL="https://your-app.railway.app"
```

**Production (Vercel)**:
- Add to Vercel environment variables
- Same value: `https://your-app.railway.app`

---

## 🎨 Render Deployment (Alternative)

### Step 1: Create Render Account

1. **Go to**: https://render.com
2. **Sign up** with GitHub

### Step 2: Create New Web Service

1. **Click**: "New +" → "Web Service"
2. **Connect**: Your GitHub repository
3. **Configure**:
   ```
   Name: enalysis-ml-service
   Region: Oregon (or closest to users)
   Branch: main
   Root Directory: ml-service
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: python -m app.main
   Instance Type: Free (or Starter $7/mo)
   ```

### Step 3: Add Environment Variables

Same as Railway (Step 3.3 above)

### Step 4: Deploy

- Render will auto-deploy
- Get your URL: `https://enalysis-ml-service.onrender.com`

**⚠️ Note**: Free tier sleeps after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.

---

## 🐳 Docker Deployment (Any Platform)

If you need Docker, here's a `Dockerfile` for the ML service:

Create `ml-service/Dockerfile`:

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV API_HOST=0.0.0.0
ENV API_PORT=8000

# Run the application
CMD ["python", "-m", "app.main"]
```

Build and run:
```bash
cd ml-service
docker build -t enalysis-ml:latest .
docker run -p 8000:8000 --env-file .env enalysis-ml:latest
```

---

## 🔍 Troubleshooting

### Error: "ModuleNotFoundError: No module named 'prophet'"

**Solution**: Ensure `requirements.txt` includes all dependencies
```bash
cd ml-service
pip install -r requirements.txt
```

### Error: "Database connection failed"

**Solution**: Check DATABASE_URL environment variable
- Must include `?sslmode=require`
- Password special characters must be URL-encoded
- Test locally first

### Error: "Port already in use"

**Solution**: Railway/Render auto-assign ports. Use:
```python
port = int(os.getenv("PORT", 8000))
```

### Deployment succeeds but health check fails

**Solution**:
1. Check logs in Railway/Render dashboard
2. Verify `/health` endpoint exists
3. Ensure service binds to `0.0.0.0` not `localhost`

---

## 📊 Monitoring Your ML Service

### Railway Monitoring

1. **Logs**: View in Railway dashboard → Deployments → Logs
2. **Metrics**: CPU, memory, network usage
3. **Alerts**: Set up in Settings → Notifications

### Render Monitoring

1. **Logs**: Dashboard → Logs tab
2. **Metrics**: Dashboard → Metrics tab
3. **Alerts**: Email notifications for failures

### Custom Monitoring

Add to your ML service (`app/main.py`):

```python
import logging
from datetime import datetime

# Log every request
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    duration = (datetime.now() - start_time).total_seconds()

    logging.info(f"{request.method} {request.url.path} - {response.status_code} - {duration:.2f}s")
    return response
```

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Tier | Best For |
|----------|-----------|-----------|----------|
| **Railway** | $5 credit/mo | $10-20/mo | Easiest setup |
| **Render** | Yes (with sleep) | $7/mo | Budget-friendly |
| **Fly.io** | $5 credit/mo | $10-15/mo | Global deployment |
| **AWS ECS** | No | $20-50/mo | Production scale |
| **Heroku** | No | $7/mo | Legacy apps |

**Recommendation**: Start with **Railway** ($5 free credit), upgrade if you need more resources.

---

## ✅ Deployment Checklist

Before deploying:
- [ ] `requirements.txt` is complete
- [ ] `.env` is not committed to git
- [ ] Code pushed to GitHub
- [ ] Database connection string ready
- [ ] API keys available (OpenWeather, etc.)

During deployment:
- [ ] Environment variables added
- [ ] Build succeeds
- [ ] Health check passes
- [ ] Domain generated/configured

After deployment:
- [ ] Health endpoint responds: `curl https://your-url/health`
- [ ] Can generate recommendations
- [ ] Logs show no errors
- [ ] Update main app `ML_SERVICE_URL`

---

## 🚀 Next Steps

After ML service is deployed:

1. ✅ Copy your Railway/Render URL
2. ✅ Update `.env.local`: `ML_SERVICE_URL="https://your-ml-service.railway.app"`
3. ✅ Test from local app
4. ⏭️ Deploy main Next.js app to Vercel
5. ⏭️ Add ML_SERVICE_URL to Vercel environment variables

---

**Ready to deploy?** Follow the Railway section above - it's the fastest path to production!
