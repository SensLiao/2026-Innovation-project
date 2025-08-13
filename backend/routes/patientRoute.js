import express from 'express';
import { getPatients, getPatientByID, addPatient, updatePatient, deletePatient } from '../controllers/patientController.js';

const router = express.Router();

router.get('/', getPatients); //get all patients
router.get('/:id', getPatientByID); //get patient by ID
router.post('/', addPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;