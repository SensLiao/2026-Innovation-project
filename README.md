# 2026-Innovation-project: medical image segementation and disease prediction paltform
For the USYD coding fest 2026-Innovation-project: It is a medical image segementation and disease prediction paltform

# Full Stack Project Structure

- `backend/`: Node.js Express server
- `frontend/`: React app (Vite)

---

# Getting Started

## Instal Dependencies
To install all dependencies, run the following command in the `backend` and `frontend` directory separately:

```
npm install
```

This will download and install all required packages as specified in `package.json`.

A list of used dependencies are documented in each directory in `DEPENDENCIES.md`.

## Start Backend
1. `cd backend`
2. `npm run dev`

## Start Frontend
1. `cd frontend`
2. `npm run dev`

## Login
- Email: doc1@hospital.com
- Password: hashedpassword1

---

# Routes
## Backend
1. `http://localhost:3000/api/patients/...` refer to `backend/routes/patientRoute.js` for all patient routes
2. `http://localhost:3000/api/users/...` refer to `backend/routes/userRoute.js` for all user routes
3. `http://localhost:3000/api/publications/...` refer to `backend/routes/pubRoute.js` for all publication routes


## Frontend
1. `http://localhost:5173/` by default root display patient page to list all patients fetched from backend
2. `http://localhost:5173/login` simple login page
3. `http://localhost:5173/profile-photo` simple page after successful login
