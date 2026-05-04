# Eagle Gym — Frontend

React + Vite + TailwindCSS

## Setup

```bash
npm install

# Development (connects to backend on localhost:3000)
npm run dev

# Production build
npm run build
```

## Render Deployment (Static Site)

1. Connect this repo to Render as **Static Site**
2. **Build Command:** `npm install && npm run build`
3. **Publish Directory:** `dist`
4. Add environment variable:
   - `VITE_API_URL` = your backend URL (e.g. `https://eagle-gym-backend.onrender.com`)

## Note

In `src/main.tsx`, the app uses relative API calls (`/api/...`).  
If your backend is on a different domain, update `src/api-client/custom-fetch.ts` to use `setBaseUrl()`.
