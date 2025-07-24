  import express from 'express';
  import dotenv from 'dotenv';
  import morgan from 'morgan';
  import userRoutes from "./routes/userRoutes";
  import { sql } from './config/db';

  dotenv.config();

  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());
  app.use(morgan("dev"));

  app.use("/api/users", userRoutes);

  async function initDB() {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          ProfilePhoto VARCHAR(255) NOT NULL,
          passwordHash VARCHAR(255) NOT NULL
        )
      `;
      console.log("Database initialised and table users is ready");
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
