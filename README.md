# 2026-Innovation-project: Medical Image Segmentation and Disease Prediction Platform

For the USYD coding fest 2026-Innovation-project: It is a medical image segmentation and disease prediction platform.

---

# Full Stack Project Structure

- `backend/`: Node.js Express server
- `frontend/`: React app (Vite)

---

# Getting Started

## Install Dependencies
To install all dependencies, run the following command in the `backend` and `frontend` directory separately:

```bash
npm install
```

This will download and install all required packages as specified in `package.json`.

A list of used dependencies is documented below.

### Backend Dependencies
- `@neondatabase/serverless`: Serverless database integration.
- `cors`: Middleware for enabling Cross-Origin Resource Sharing.
- `dotenv`: Loads environment variables from `.env` file.
- `express`: Web framework for Node.js.
- `morgan`: HTTP request logger middleware.
- `nodemon`: Utility that monitors for file changes and automatically restarts the server.
- `cookie-parser`: HTTP cookie usage. req.cookiese.xxx to access cookie content
- `jsonwebtoken`: JWT usage
- `bcrypt`: For password hash

### Frontend Dependencies
#### Production Dependencies
- `axios`: Promise-based HTTP client for the browser and Node.js.
- `lucide-react`: React components for Lucide icons.
- `react`: JavaScript library for building user interfaces.
- `react-dom`: Entry point for DOM rendering in React.
- `react-router-dom`: Declarative routing for React applications.
- `zustand`: A small, fast, and scalable state-management solution.

#### Development Dependencies
- `@eslint/js`: ESLint configuration for JavaScript.
- `@tailwindcss/postcss`: Tailwind CSS PostCSS plugin.
- `@types/react`: TypeScript definitions for React.
- `@types/react-dom`: TypeScript definitions for React DOM.
- `@vitejs/plugin-react`: Official Vite plugin for React.
- `autoprefixer`: PostCSS plugin to parse CSS and add vendor prefixes.
- `eslint`: Pluggable JavaScript linter.
- `eslint-plugin-react-hooks`: ESLint rules for React Hooks.
- `eslint-plugin-react-refresh`: ESLint plugin for React Fast Refresh.
- `globals`: Global variables for JavaScript.
- `postcss`: A tool for transforming CSS with JavaScript.
- `tailwindcss`: A utility-first CSS framework.
- `vite`: Next-generation frontend tooling.

---

# Start Backend
1. `cd backend`
2. `npm run dev`

# Start Frontend
1. `cd frontend`
2. `npm run dev`

---

# Login
- Email: doc1@hospital.com
- Password: signup

- Email: user2@email.com
- Password: user2pwd

---

# Routes

## Backend
1. `http://localhost:3000/api/patients/...` refer to `backend/routes/patientRoute.js` for all patient routes.
2. `http://localhost:3000/api/users/...` refer to `backend/routes/userRoute.js` for all user routes.
3. `http://localhost:3000/api/publications/...` refer to `backend/routes/pubRoute.js` for all publication routes.

## Frontend
1. `http://localhost:5173/` by default root displays the patient page to list all patients fetched from the backend.
2. `http://localhost:5173/login` simple login page.
3. `http://localhost:5173/profile-photo` simple page after successful login.
