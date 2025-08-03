import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import patientRoute from './routes/patientRoute.js';

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
