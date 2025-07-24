import { Request, Response } from 'express';
import { sql } from "../config/db";

export const getPatients = async (req: Request, res: Response): Promise<void>  => {
    try{
        const patients = await sql`
            SELECT * FROM patients;
        `;
        console.log("Patients fetched successfully");
        res.status(200).json({success:true, data: patients});
    }catch(error){
        console.error("Error getPatients function: ", error);
        res.status(500).json({message: "server error"});
    }
};