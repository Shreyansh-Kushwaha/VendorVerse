# 🛒 VendorVerse

A marketplace that connects **Indian street food vendors** with **local raw-material suppliers** — browse live inventory, compare prices per unit, order, and track delivery.

---

## 🚀 Features

- 🔐 Session auth with httpOnly JWT cookies, separate Vendor and Supplier roles
- 📦 Supplier inventory with photos, per-unit pricing and live stock
- ⚖️ Every item priced per unit (kg, L, piece, crate…) so listings are comparable
- 🛒 Cart and checkout across multiple suppliers in one go
- 📍 Delivery address and notes captured at checkout and shown to the supplier
- 🚚 Order workflow — Pending → Accepted → Packed → Out for delivery → Delivered
- 📊 Revenue and spend analytics for both sides
- 🌗 Dark mode, responsive, installable as a PWA

---

## 🧠 Tech Stack

| Frontend | Backend | Database | Hosting |
|----------|---------|----------|---------|
| React 18, Vite, Tailwind CSS | Node.js, Express 5, Zod | MongoDB Atlas, Mongoose | Render |

---

## 🛠️ Local setup

**1. Clone and install** — the backend and frontend have separate dependencies.

    git clone https://github.com/Shreyansh-Kushwaha/VendorVerse.git
    cd VendorVerse
    cd Backend  && npm install && cd ..
    cd Frontend && npm install && cd ..

**2. Configure the backend.** Copy `Backend/.env.example` to `Backend/.env` and fill it in.

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | Signs session cookies. The server refuses to start without it. |
| `CLOUDINARY_CLOUD_NAME` | for image upload | |
| `CLOUDINARY_API_KEY` | for image upload | |
| `CLOUDINARY_API_SECRET` | for image upload | |
| `CORS_ORIGINS` | no | Comma separated. Leave empty when Express serves the built SPA. |
| `PORT` | no | Defaults to 3000 |
| `NODE_ENV` | no | Set to `production` on deploy so cookies are marked Secure |

Generate a secret with:

    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

**3. Run it.**

Development — two terminals. Vite proxies `/api` to the backend.

    cd Backend  && npm run dev     # http://localhost:3000
    cd Frontend && npm run dev     # http://localhost:5173

Production — build the SPA first, then the backend serves it from one process.

    cd Frontend && npm run build
    cd Backend  && npm start       # http://localhost:3000

---

## ✅ Tests

    cd Backend && npm test

Integration tests run against a real MongoDB spun up in memory, no Atlas connection needed. They cover authentication, per-endpoint authorization, stock reservation under concurrency, order status rules and unit handling.

---

## 📡 API

All routes are under `/api`. Everything except registration, login and public supplier profiles requires a session cookie.

| Method | Route | Who |
|---|---|---|
| `POST` | `/register` `/login` `/logout` | anyone |
| `GET` | `/me` | signed in |
| `PATCH` `DELETE` | `/users/:id` | that user only |
| `GET` | `/suppliers` | signed in |
| `GET` | `/suppliers/:id` `/suppliers/:id/inventory` | anyone |
| `POST` | `/suppliers` | supplier |
| `PATCH` `DELETE` | `/suppliers/:id/inventory/:itemId` | that supplier only |
| `POST` | `/placeOrder` `/placeOrders` | vendor |
| `GET` | `/vendor/orders` `/vendor/analytics` | vendor |
| `GET` | `/orders` `/supplier/analytics` | supplier |
| `PATCH` | `/orders/:id/status` | that order's supplier |
| `GET` | `/orders/:id` | that order's buyer or seller |
| `POST` | `/upload` | signed in |
| `GET` | `/health` | anyone |

Item name and price are always read from the live listing — the client cannot set either.

---

## 📢 Roadmap

- 📧 Notify suppliers when an order arrives
- 🙅 Let vendors cancel an order while it is still Pending
- ⭐ Supplier ratings and reviews
- 📍 Match vendors to suppliers who deliver to their area
- 💳 Online payment via UPI

---

## ⭐ Show Your Support

If you like this project — star it, fork it, use it in your own.
