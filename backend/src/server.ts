import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import userRoutes from "./routes/userRoutes";
import { sql } from './config/db';
import patientRoutes from './routes/patientRoutes';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/users", userRoutes);
app.use("/api/patients", patientRoutes);

async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        profilephoto VARCHAR(255) NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        UNIQUE (name, profilephoto, passwordHash)
      );
    `;
    console.log("Database initialised and table users is ready");

    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        age INT NOT NULL,
        gender VARCHAR(255) NOT NULL,
        phone VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        profilephoto VARCHAR(255) NOT NULL,
        UNIQUE (name, age, gender, phone, email, profilephoto)
      );
    `;
    console.log("Database initialised and table patients is ready");

    await sql`
      INSERT INTO users (name, profilephoto, passwordHash) VALUES ('Default User', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D', 'password123') ON CONFLICT (name, profilephoto, passwordHash) DO NOTHING;
    `;
    console.log("Default user inserted");

    await sql`
      INSERT INTO patients (name, age, gender, phone, email, profilephoto) VALUES ('Default Patient', 25, 'Male', '1234567890', 'default@example.com', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D') ON CONFLICT (name, age, gender, phone, email, profilephoto) DO NOTHING;
    `;
    console.log("Default patient inserted");
  } catch (error) {
    console.error("Error initialising database", error);
    process.exit(1);
  }
}

initDB().then(() => {
  app.listen(port, () => {
    console.log(`Backend server is running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

export default app;
