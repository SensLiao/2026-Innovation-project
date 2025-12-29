import {neon} from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

// Use dev branch database (hidden-field) for development
// This matches diagnosisService.js and ragService.js
const DEV_DB = process.env.DEV_DATABASE_URL;

export const sql = neon(DEV_DB);

// this sql function we export is used as a tagged template literal, 
// which allows us to write SQL quieries safely
