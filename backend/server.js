import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import patientRoute from './routes/patientRoute.js';
import { sql } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// parse incoming data
// send image/price/etc., extract json data
app.use(express.json());// used for req.body
app.use(cors()); // enable CORS for all routes
app.use(morgan('dev')); // log requests to the console

// API routes
app.get('/', (req, res) => {
  res.send('Hello from Express backend!');
});

app.use('/api/patients', patientRoute);

async function initDB() {
  // Initialize your database connection here if needed
  // For example, connect to MongoDB or any other database
  try{
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        UID SERIAL PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Email VARCHAR(50) UNIQUE NOT NULL,
        Phone VARCHAR(10) UNIQUE,
        PasswordHash VARCHAR(100) NOT NULL,
        CreatedAt TIMESTAMP DEFAULT NOW(),
        ProfilePhoto VARCHAR(255)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        PID SERIAL PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Age INT NOT NULL,
        Gender VARCHAR(10) NOT NULL,
        Phone VARCHAR(10),
        Email VARCHAR(50),
        ProfilePhoto VARCHAR(255),
        CreatedAt TIMESTAMP DEFAULT NOW(),

        CONSTRAINT patient_exists UNIQUE (Name, Age, Gender, Phone, Email, ProfilePhoto)
      );
    `;
    console.log('Database Users and Patients initialized');
  }catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
  
}

async function initDefaultData() {
  // Initialize default data if needed
  try {
    const defaultPatients = [
      { Name: 'John Doe', Age: 30, Gender: 'Male', Phone: '0123456789', Email: 'default@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' },
      { Name: 'Jane Smith', Age: 25, Gender: 'Female', Phone: '0987654321', Email: 'jane_smith@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' }
    ];
    for (const patient of defaultPatients) {
      await sql`
        INSERT INTO patients (Name, Age, Gender, Phone, Email, ProfilePhoto)
        VALUES (${patient.Name}, ${patient.Age}, ${patient.Gender}, ${patient.Phone}, ${patient.Email}, ${patient.ProfilePhoto})
        ON CONFLICT (Name, Age,Gender, Phone, Email, ProfilePhoto) DO NOTHING;
      `;
    }
    console.log('Default patients initialized');
  } catch (error) {
    console.error('Error initializing default data:', error);
  }

  try {
    const defaultUsers = [
      { Name: 'Doc1', Email: 'doc1@hospital.com', Phone: '0123456789', PasswordHash: 'hashedpassword1', ProfilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' }
    ];
    for (const user of defaultUsers) {
      await sql`
        INSERT INTO users (Name, Email, Phone, PasswordHash, ProfilePhoto)
        VALUES (${user.Name}, ${user.Email}, ${user.Phone}, ${user.PasswordHash}, ${user.ProfilePhoto})
        ON CONFLICT (Email) DO NOTHING;
      `;
    }
    console.log('Default users initialized');
  } catch (error) {
    console.error('Error initializing default users:', error);
  }
}

// app.listen(PORT, () => {
//   console.log(`Backend server running on http://localhost:${PORT}`);
// });

initDB().then(() => {
  // initDefaultData().then(() => {
  //   console.log('Default data initialized');
  // }).catch((error) => {
  //   console.error('Error initializing default data:', error);
  // });
  // Start the server after initializing the database
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
export default app;