import express from 'express';
import { getPub, addPub, updatePub, deletePub } from '../controllers/pubController.js';
const router = express.Router();

router.get('/:uid', getPub); // Get publication by ID
router.post('/:uid', addPub); // Add a new publication
router.put('/:pid', updatePub); // Update publication by ID
router.delete('/:pid', deletePub); // Delete publication by ID

export default router;