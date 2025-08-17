import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import patientRoute from './routes/patientRoute.js';
import userRoute from './routes/userRoute.js';
import pubRoute from './routes/pubRoute.js';
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
app.use('/api/users', userRoute);
app.use('/api/publications', pubRoute);

async function initDB() {
  // Initialize your database connection here if needed
  // For example, connect to MongoDB or any other database
  try{
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        UID SERIAL PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Email VARCHAR(50) UNIQUE NOT NULL,
        Phone VARCHAR(32) UNIQUE,
        PasswordHash VARCHAR(255) NOT NULL,
        CreatedAt TIMESTAMP DEFAULT NOW(),
        ProfilePhoto VARCHAR(255),
        YearOfExperience INT DEFAULT 0 CHECK (YearOfExperience BETWEEN 0 AND 100),
        Education VARCHAR(100),
        Languages VARCHAR(100)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS publication (
        PID SERIAL PRIMARY KEY,
        Title VARCHAR(100) NOT NULL,
        Description TEXT,
        Author VARCHAR(50) NOT NULL,
        PublicationDate DATE NOT NULL,
        Link VARCHAR(255),
        UID INT NOT NULL REFERENCES users(UID) ON DELETE CASCADE
      );
    `
    await sql`
      CREATE TABLE IF NOT EXISTS patients (
        PID SERIAL PRIMARY KEY,
        Name VARCHAR(50) NOT NULL,
        Age INT NOT NULL,
        DateOfBirth DATE NOT NULL,
        Gender VARCHAR(10) NOT NULL,
        Phone VARCHAR(32),
        Email VARCHAR(50),
        ProfilePhoto VARCHAR(255),
        CreatedAt TIMESTAMP DEFAULT NOW(),
        EmergencyContactName VARCHAR(50),
        EmergencyContactPhone VARCHAR(32),
        StreetAddress VARCHAR(100),
        Suburb VARCHAR(50),
        State VARCHAR(50),
        Postcode VARCHAR(10),
        Country VARCHAR(50),

        CONSTRAINT patient_exists UNIQUE (Name, Age, DateOfBirth, Gender, Phone, Email, ProfilePhoto)
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
      { Name: 'John Doe', Age: 35, DateOfBirth: '1990-02-03', Gender: 'Male', Phone: '0123456789', Email: 'default@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' },
      { Name: 'Jane Smith', Age: 25, DateOfBirth: '2000-04-01', Gender: 'Female', Phone: '0987654321', Email: 'jane_smith@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' },
      { Name: 'Alice Johnson', Age: 25, DateOfBirth: '2000-06-08', Gender: 'Female', Phone: '0657483921', Email: 'alice@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D' },
      { Name: 'Bob Brown', Age: 30, DateOfBirth: '1995-08-03', Gender: 'Male', Phone: '0394867294', Email: 'bob@default.com', ProfilePhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=700&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHBvcnRyYWl0fGVufDB8fDB8fHww' }

    ];
    for (const patient of defaultPatients) {
      await sql`
        INSERT INTO patients (Name, Age, DateOfBirth, Gender, Phone, Email, ProfilePhoto)
        VALUES (${patient.Name}, ${patient.Age}, ${patient.DateOfBirth}, ${patient.Gender}, ${patient.Phone}, ${patient.Email}, ${patient.ProfilePhoto})
        ON CONFLICT (Name, Age, DateOfBirth, Gender, Phone, Email, ProfilePhoto) DO NOTHING;
      `;
    }
    console.log('Default patients initialized');
  } catch (error) {
    console.error('Error initializing default patients:', error);
  }

  try{

  }catch (error) {
    console.error('Error initializing default publications:', error);
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

initDB().then(() => {
  // initDefaultData()
  // Start the server after initializing the database
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});
export default app;