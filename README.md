# Acreo – farm-to-hostel marketplace (HTML + CSS + JS, Node + MongoDB)
`frontend/` = plain HTML/CSS/JS (Vercel). `backend/` = Express + MongoDB (Render).

## 1. MongoDB Atlas (free)
Create a cluster → Database Access: add a user → Network Access: allow 0.0.0.0/0 → copy the connection string (add `/acreo` as database name).

## 2. Backend on Render
New → Web Service → connect your GitHub repo → Root Directory `backend` → Build `npm install` → Start `npm start`.
Environment variables: `MONGO_URI`, `JWT_SECRET` (long random text), `CLIENT_URL` (your Vercel URL, no trailing slash), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (this creates your admin account on first start).
Free Render services sleep when idle; the first request can take ~30-60 seconds.

## 3. Frontend on Vercel
Edit `frontend/config.js` → set `window.API_URL='https://YOUR-SERVICE.onrender.com/api'`, commit, push.
Vercel → Add New Project → import repo → Root Directory `frontend` → Framework "Other" → Deploy.

## Run locally
`cd backend && cp .env.example .env` (fill it) `&& npm install && npm start`; open `frontend/index.html` with any static server (e.g. `npx serve frontend`). Add `http://localhost:3000` as CLIENT_URL if needed, or leave CLIENT_URL unset locally.

## Flow
Farmer signs up → admin (login with ADMIN_EMAIL) approves → farmer adds products → buyer orders → farmer accepts, dispatches, delivers.
Label any test data as "demo data" in your report.
