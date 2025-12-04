# Deploy ML Service - Quick Start (10 Minutes)

## 🎯 What We're Doing
Deploy your Python ML service to Railway so it's accessible from anywhere.

---

## ✅ Files Already Created

I've created these deployment files for you:
- ✅ `railway.json` - Railway configuration
- ✅ `ml-service/nixpacks.toml` - Build configuration

---

## 🚀 Deploy in 4 Steps

### Step 1: Push to GitHub (5 min)

```bash
cd C:\Users\tinas\Multisite\enalysis-mvp

# Initialize git (if not already done)
git init

# Add all files (secrets are protected by .gitignore!)
git add .

# Commit
git commit -m "Ready for production deployment"

# Create GitHub repo:
# 1. Go to https://github.com/new
# 2. Name: enalysis-mvp
# 3. Don't initialize with README (you already have files)
# 4. Click "Create repository"

# Then run these commands (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/enalysis-mvp.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy to Railway (3 min)

1. **Go to**: https://railway.app
2. **Click**: "Login" → "Login with GitHub"
3. **Authorize** Railway
4. **Click**: "New Project"
5. **Select**: "Deploy from GitHub repo"
6. **Choose**: `enalysis-mvp` repository
7. **Railway will**: Start deploying automatically

---

### Step 3: Configure Environment Variables (2 min)

In Railway dashboard:

1. **Click**: Your service name
2. **Go to**: "Variables" tab
3. **Click**: "New Variable"
4. **Add these** (one at a time):

```bash
DATABASE_URL
postgresql://postgres:6495424Ari%21@db.lccbpaopmruxdvfkdoor.supabase.co:5432/postgres?sslmode=require

API_HOST
0.0.0.0

API_PORT
8000

LOG_LEVEL
info

MODEL_CACHE_DIR
./models/cache

OPENWEATHER_API_KEY
a53902175c3eced21bcd3ac813d4c9ba

PYTHONUNBUFFERED
1
```

5. **Service will** redeploy automatically with new variables

---

### Step 4: Get Your URL & Test (1 min)

1. **Go to**: "Settings" tab
2. **Find**: "Networking" section
3. **Click**: "Generate Domain"
4. **Copy** your URL: `https://enalysis-mvp-production-xxxx.up.railway.app`

5. **Test it**:
   ```bash
   # In PowerShell:
   curl https://your-railway-url.railway.app/health

   # Should return:
   # {"status":"healthy","timestamp":"2025-12-04T..."}
   ```

---

## ✅ Success Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Environment variables added
- [ ] Deployment successful (green checkmark)
- [ ] Health endpoint responds
- [ ] Railway URL copied

---

## 🎯 Next: Update Your Local App

Once deployed, update your `.env.local`:

```bash
ML_SERVICE_URL="https://your-railway-url.railway.app"
```

Then restart your Next.js app:
```bash
# Stop the running dev server (Ctrl+C)
npm run dev
```

---

## 🆘 Troubleshooting

### "Build failed"
**Check**: Railway logs for error message
**Common fix**: Missing dependencies in requirements.txt

### "Service won't start"
**Check**: Environment variables are set correctly
**Common fix**: DATABASE_URL missing or incorrect

### "Health check fails"
**Check**: Service logs in Railway
**Common fix**: Port configuration (should be 0.0.0.0:8000)

---

## 💡 Pro Tips

1. **View Logs**: Click "Deployments" → Select latest → "View Logs"
2. **Custom Domain**: Settings → Networking → Add custom domain
3. **Auto-deploys**: Every git push will trigger new deployment
4. **Rollback**: Deployments tab → Click previous deployment → "Redeploy"

---

## 📊 What Railway Provides

- ✅ **$5 free credit/month** (enough for testing)
- ✅ **Automatic HTTPS**
- ✅ **Auto-scaling**
- ✅ **Zero-downtime deploys**
- ✅ **Built-in monitoring**
- ✅ **Log aggregation**

---

**Ready?** Start with Step 1 - Push to GitHub!

Need help? Check [ML_SERVICE_DEPLOYMENT.md](ML_SERVICE_DEPLOYMENT.md) for detailed instructions.
