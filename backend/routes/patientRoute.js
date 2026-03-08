import express from 'express';
import { getPatients, getPatientByID, addPatient, updatePatient, deletePatient, getPatientNum, getPatientsThisWeek } from '../controllers/patientController.js';

const router = express.Router();

router.get('/', getPatients); //get all patients
router.get('/:id', getPatientByID); //get patient by ID
router.post('/', addPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.get('/stats/total', getPatientNum);
router.get('/stats/weekly', getPatientsThisWeek);

export default router;