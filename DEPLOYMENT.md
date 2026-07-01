# Deployment Guide — Vercel + Render

## Prerequisites

- GitHub account
- Vercel account (free)
- Render account (free)
- Project pushed to GitHub

---

## Step 1: Push to GitHub

```bash
cd ~/.hermes/unified-dashboard
git init
git add .
git commit -m "M1-M7 + Dashboard MVP"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Step 2: Deploy Backend (Render)

1. Go to https://dashboard.render.com
2. Click **New** → **Web Service**
3. Connect GitHub repo
4. Settings:
   - **Name:** `hermes-ai-os-backend`
   - **Runtime:** Node
   - **Build Command:**
     ```
     cd packages/server && npm install && npm run build
     ```
   - **Start Command:**
     ```
     cd packages/server && node dist/index.js
     ```
   - **Health Check Path:** `/health`
5. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://your-project.vercel.app` |
6. Click **Create Web Service**
7. Wait for deploy → copy the URL (e.g. `https://hermes-ai-os-backend.onrender.com`)

---

## Step 3: Deploy Frontend (Vercel)

1. Go to https://vercel.com/new
2. Import GitHub repo
3. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add Environment Variables:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://your-backend.onrender.com` |
   | `VITE_WS_URL` | `https://your-backend.onrender.com` |
5. Click **Deploy**
6. Wait for deploy → copy the URL (e.g. `https://your-project.vercel.app`)

---

## Step 4: Update CORS

1. Go to Render dashboard
2. Open your backend service
3. Go to **Environment** tab
4. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://your-project.vercel.app
   ```
5. Save → service will redeploy

---

## Step 5: Verify

1. Open `https://your-project.vercel.app`
2. Check:
   - [ ] Dashboard loads
   - [ ] Health status shows "ok"
   - [ ] WebSocket connects (green dot)
   - [ ] Can create tasks
   - [ ] Events appear in real-time

---

## Environment Variables Summary

### Vercel (Frontend)
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://backend.onrender.com` |
| `VITE_WS_URL` | WebSocket URL | `https://backend.onrender.com` |

### Render (Backend)
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `10000` |
| `CORS_ORIGIN` | Allowed origin | `https://frontend.vercel.app` |
| `NODE_ENV` | Environment | `production` |

---

## File Structure

```
unified-dashboard/
├── dashboard/              ← Frontend (Vercel)
│   ├── vercel.json
│   ├── .env.example
│   ├── src/
│   │   ├── api.ts          ← Uses VITE_API_URL
│   │   ├── useWebSocket.ts ← Uses VITE_WS_URL
│   │   ├── App.tsx
│   │   └── App.css
│   └── package.json
├── packages/server/        ← Backend (Render)
│   ├── .env.example
│   ├── src/
│   │   └── index.ts
│   └── package.json
└── render.yaml             ← Render config
```

---

## Troubleshooting

### WebSocket not connecting
- Check `VITE_WS_URL` is set correctly
- Ensure backend allows CORS from frontend domain
- Check Render logs for errors

### API calls failing
- Check `VITE_API_URL` is set correctly
- Ensure backend is running (check `/health`)
- Check browser console for CORS errors

### Build failing on Vercel
- Ensure root directory is set to `dashboard`
- Check build logs for errors
- Verify `package.json` has correct scripts
