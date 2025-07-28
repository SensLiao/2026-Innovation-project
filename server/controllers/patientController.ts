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

export const getPatientById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try{
        const patient = await sql`
            SELECT * FROM patients WHERE id = ${id};
        `;
        if (patient.length === 0) {
            res.status(404).json({message: "Patient not found"});
            return;
        }
        console.log("Patient fetched successfully");
        res.status(200).json({success:true, data: patient[0]});
    }catch(error){
        console.error("Error getPatientById function: ", error);
        res.status(500).json({message: "server error"});
    }
};

export const createPatient = async (req: Request, res: Response): Promise<void> => {
    try{
        const {name, age, gender, phone, email, profilephoto} = req.body;
        const patient = await sql`
            INSERT INTO patients (name, age, gender, phone, email, profilephoto)
            VALUES (${name}, ${age}, ${gender}, ${phone}, ${email}, ${profilephoto})
            RETURNING *;
        `;
        console.log("Patient created successfully");
        res.status(201).json({success:true, data: patient});
    }catch(error){
        console.error("Error createPatient function: ", error);
        res.status(500).json({message: "server error"});
    }
};

export const updatePatient = async (req: Request, res: Response): Promise<void> => {
    try{
        const { id } = req.params;
        const {name, age, gender, phone, email, profilephoto} = req.body;
        if (!name || !age || !gender || !phone || !email || !profilephoto) {
            res.status(400).json({ success: false, message: "Please fill all fields" });
        }
        const patient = await sql`
            UPDATE patients
            SET name = ${name}, age = ${age}, gender = ${gender}, phone = ${phone}, email = ${email}, profilephoto = ${profilephoto}
            WHERE id = ${id}
            RETURNING *;
        `;
        if (patient.length === 0) {
            res.status(404).json({message: "Patient not found"});
            return;
        }

        console.log("Patient updated successfully, ID:", id);
        res.status(200).json({success:true, data: patient});
    }catch(error){ 
        console.error("Error updatePatient function: ", error);
        res.status(500).json({message: "server error"});
    }
};

export const deletePatient = async (req: Request, res: Response): Promise<void> => {
    try{
        const { id } = req.params;
        const patient = await sql`
            DELETE FROM patients WHERE id = ${id} RETURNING *;
        `;
        if (patient.length === 0) {
            res.status(404).json({message: "Patient not found"});
            return;
        }
        console.log("Patient deleted successfully, ID:", id);
        res.status(200).json({success:true, data: patient});
    }catch(error){
        console.error("Error deletePatient function: ", error);
        res.status(500).json({message: "server error"});
    }
};