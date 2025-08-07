import express from 'express';
import { getUsers } from '../controllers/userController.js';
const router = express.Router();

// Route to get all patients
router.get('/', getUsers);

export default router;