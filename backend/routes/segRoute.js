import express from 'express';
import { getSegs, getSegByID, addSeg, getSegNum, getSegThisWeek } from '../controllers/segController.js';

const router = express.Router();

router.get('/', getSegs); //get all segs
router.get('/stats/weekly', getSegThisWeek); //get segs registered this week
router.get('/stats/total', getSegNum); //get total segs count
router.get('/:id', getSegByID); //get seg by ID
router.post('/', addSeg);

export default router;