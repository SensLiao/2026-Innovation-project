import express from 'express';
import { getPatients } from '../controllers/patientController.js';

const router = express.Router();

// Route to get all patients
router.get('/', getPatients);

export default router;