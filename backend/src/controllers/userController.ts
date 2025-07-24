import { Request, Response } from 'express';
import { sql } from "../config/db";

export const getUsers = async (req: Request, res: Response): Promise<void>  => {
    try{
        const users = await sql`
            SELECT * FROM users;
        `;
        console.log("Users fetched successfully");
        res.status(200).json({success:true, data: users});
    }catch(error){
        console.error("Error getUsers function: ", error);
        res.status(500).json({message: "server error"});
    }
};