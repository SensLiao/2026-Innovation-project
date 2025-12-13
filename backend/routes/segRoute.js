import express from 'express';
import { getSegs, getSegByID, addSeg } from '../controllers/segController.js';

const router = express.Router();

router.get('/', getSegs); //get all segs
router.get('/:id', getSegByID); //get seg by ID
router.post('/', addSeg);

export default router;