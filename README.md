# 🇧🇩 Bangladesh Citizen Card System — Backend API

Node.js + Express + MySQL backend for the Citizen Card System.

## 📁 Project Structure

```
dbms_backend/
├── server.js              ← Entry point
├── .env.example           ← Copy to .env and fill in values
├── database.sql           ← MySQL schema — run this first
├── package.json
├── config/
│   └── db.js              ← MySQL connection pool
├── middleware/
│   └── auth.js            ← JWT auth middleware
├── controllers/
│   ├── authController.js  ← Register, Login, OTP, Reset
│   ├── userController.js  ← Profile, Cards
│   └── adminController.js ← Admin panel operations
└── routes/
    ├── auth.js
    ├── user.js
    └── admin.js
```

## 🚀 Setup Guide

### Step 1 — Install dependencies
```bash
npm install
```

### Step 2 — Setup MySQL database
```bash
mysql -u root -p < database.sql
```

### Step 3 — Configure environment
```bash
cp .env.example .env
# Edit .env with your MySQL password and JWT secret
```

### Step 4 — Create admin with real bcrypt hash
```bash
node -e "const b=require('bcryptjs'); b.hash('Admin@1234',10).then(h=>console.log(h))"
# Copy the output hash → paste into database.sql INSERT or UPDATE admins directly
```

### Step 5 — Start server
```bash
npm run dev    # development (with nodemon)
npm start      # production
```

---

## 📡 API Endpoints

### Auth  `/api/auth`
| Method | Endpoint          | Description          |
|--------|-------------------|----------------------|
| POST   | /register         | New user registration|
| POST   | /login            | User login           |
| POST   | /send-otp         | Send OTP to phone    |
| POST   | /verify-otp       | Verify OTP           |
| POST   | /reset-password   | Reset password       |

### User  `/api/user`  🔒 (JWT required)
| Method | Endpoint          | Description          |
|--------|-------------------|----------------------|
| GET    | /profile          | Get user profile     |
| GET    | /cards            | Get user's cards     |
| PUT    | /change-password  | Change password      |

### Admin  `/api/admin`  🔒 (Admin JWT required)
| Method | Endpoint               | Description             |
|--------|------------------------|-------------------------|
| POST   | /login                 | Admin login             |
| GET    | /stats                 | Dashboard stats         |
| GET    | /users                 | All users (paginated)   |
| GET    | /users/:id             | Single user + cards     |
| PATCH  | /users/:id/status      | Update user status      |
| PATCH  | /cards/:id/status      | Approve/reject/issue    |

---

## 🔒 Authentication

Include JWT token in request header:
```
Authorization: Bearer <your_token>
```

---

## 📝 Register Request Example

```json
POST /api/auth/register
{
  "nid_number": "1234567890123",
  "full_name": "Tanvir Ahmed",
  "date_of_birth": "1999-06-15",
  "phone": "01712345678",
  "password": "SecurePass@123",
  "card_types": ["family", "student"]
}
```

## 🌐 Connecting Frontend

In your GitHub Pages frontend JS, replace hardcoded logic with:
```javascript
const API_BASE = 'https://your-backend-url.com/api';

// Login example
const res = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier, password })
});
const data = await res.json();
if (data.success) localStorage.setItem('token', data.token);
```

## 🚢 Free Deployment Options

- **Railway** → railway.app (easiest, MySQL built-in)
- **Render** → render.com (free tier available)
- **Cyclic** → cyclic.sh
