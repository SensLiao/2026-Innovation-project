import { sql } from "../config/db.js";

export const getPatients = async (req, res) => {
    try {
        const patients = await sql`
            SELECT * FROM patients
            ORDER BY id DESC;
        `;
        console.log("Patients fetched successfully");
        res.status(200).json({success:true, data: patients});
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

