import express from "express";
import { getPatients } from "../controllers/patientController";

const router = express.Router();

router.get("/", getPatients);

export default router;