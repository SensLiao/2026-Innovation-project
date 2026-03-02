import express from 'express';
import { getReportNum, getApprovedNum, getDraftNum, getReviseNum, getDraftThisWeek, getReviseThisWeek, getApprovedThisWeek } from '../controllers/reportController.js';

const router = express.Router();

router.get('/stats/total', getReportNum); //get total reports count
router.get('/stats/approved', getApprovedNum); //get approved reports count
router.get('/stats/draft', getDraftNum); //get draft reports count
router.get('/stats/revise', getReviseNum); //get revise reports count
router.get('/stats/draft/weekly', getDraftThisWeek); //get draft reports this week
router.get('/stats/revise/weekly', getReviseThisWeek); //get revising reports this week
router.get('/stats/approved/weekly', getApprovedThisWeek); //get approved reports this week

export default router;