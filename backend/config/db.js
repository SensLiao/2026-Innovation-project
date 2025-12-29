import {neon} from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

// Use dev branch database (hidden-field) for development
// This matches diagnosisService.js and ragService.js
const DEV_DB = 'postgresql://neondb_owner:npg_JmAYfQy70rIF@ep-hidden-field-a7ucgm04-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';

export const sql = neon(DEV_DB);

// this sql function we export is used as a tagged template literal, 
// which allows us to write SQL quieries safely
