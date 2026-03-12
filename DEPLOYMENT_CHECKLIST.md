# 🚀 Deployment Troubleshooting Checklist

## 1. ✅ Verify Vercel Frontend Deployment

**Check Deployment Status:**
- Go to [Vercel Dashboard](https://vercel.app/dashboard)
- Find your `lookinportal` project
- Check if latest deployment shows commit `d39307b` 
- Status should be ✅ **Ready** (not Building/Failed)

**Manual Redeploy (if needed):**
```bash
git commit --allow-empty -m "trigger Vercel redeploy"
git push origin main
```

**Environment Variables Check:**
- Verify `NEXT_PUBLIC_API_URL` is set to your Render backend URL
- Example: `https://lookin-api.onrender.com` (or your actual URL)

---

## 2. 🐳 Verify Render Backend Deployment  

**Check Deployment Status:**
- Go to [Render Dashboard](https://dashboard.render.com/)
- Find your `lookin-api` service
- Check **Recent Deploys** tab
- Latest deploy should show commit `d39307b`
- Status should be ✅ **Live** (not Building/Deploy Failed)

**Manual Redeploy (if needed):**
- Click **Manual Deploy** → **Deploy latest commit**

**Environment Variables Check:**
Verify all required variables are set:
```
DATA_DIR = data
BIOMETRICS_FILE = students_biometrics.json  
ATTENDANCE_CSV = attendance_logs.csv
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1...
CORS_ORIGINS = http://localhost:3000,https://lookinportal.vercel.app
```

---

## 3. 🔍 Test Live Endpoints

**Frontend Test:**
- Visit your Vercel URL
- Check browser dev tools → Network tab for any failed requests
- Try both login roles (Admin vs Student)

**Backend Test:**
- Visit `https://your-render-url.onrender.com/docs`
- Should show FastAPI interactive docs
- Test the `/api/attendance/student/{student_id}` endpoint

**CORS Test:**
- Login as admin on Vercel frontend
- Try uploading a test image (Enroll Student)
- Check browser console for CORS errors

---

## 4. 🐛 Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Stale Cache** | Old UI showing | Hard refresh (Ctrl+Shift+R) |
| **CORS Error** | Network failures in browser | Update `CORS_ORIGINS` in Render |
| **Build Failed** | Red status in Vercel/Render | Check build logs for errors |
| **Env Vars Missing** | 500 errors or blank API responses | Verify all env vars are set |
| **Docker Build Timeout** | Render deploy stuck | Wait or manual redeploy |

---

## 5. 📊 Health Check URLs

**Frontend Health:** `https://lookinportal.vercel.app`  
**Backend Health:** `https://your-render-url.onrender.com/docs`  
**Backend Root:** `https://your-render-url.onrender.com/` (should show FastAPI message)

**Expected Response Times:**
- Frontend: < 2 seconds  
- Backend (cold start): < 30 seconds first request  
- Backend (warm): < 3 seconds

---

## 6. 🔧 Emergency Fixes

**If Vercel is broken:**
```bash
# Force redeploy with empty commit
git commit --allow-empty -m "force Vercel rebuild" 
git push origin main
```

**If Render is broken:**
- Go to Render → Settings → Delete Service  
- Recreate from GitHub (auto-deploys latest `main`)
- Re-add all environment variables

**If both are broken:**
```bash
# Rollback to known working commit
git log --oneline  # find last working commit
git revert d39307b  # revert the latest if it's problematic
git push origin main
```