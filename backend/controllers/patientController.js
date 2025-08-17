import { sql } from "../config/db.js";

export const getPatients = async (req, res) => {
    try {
        const patients = await sql`
            SELECT * FROM patients
            ORDER BY PID DESC;
        `;
        console.log("Patients fetched successfully");
        res.status(200).json({success:true, data: patients});
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getPatientByID = async (req, res) => {
    const { id } = req.params;
    try {
        const patient = await sql`
            SELECT * FROM patients WHERE PID = ${id};
        `;
        if (patient.length === 0) {
            return res.status(404).json({ message: "Patient not found" });
        }
        console.log("Patient fetched successfully");
        res.status(200).json({success:true, data: patient[0]});
    } catch (error) {
        console.error("Error fetching patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const addPatient = async (req, res) => {
    const { name, age, dateofbirth, gender, phone, email, profilephoto, emergencycontactname, emergencycontactphone, streetaddress, suburb, state, postcode, country } = req.body;
    try {
        const newPatient = await sql`
            INSERT INTO patients (Name, Age, DateOfBirth, Gender, Phone, Email, ProfilePhoto, EmergencyContactName, EmergencyContactPhone, StreetAddress, Suburb, State, Postcode, Country)
            VALUES (${name}, ${age}, ${dateofbirth}, ${gender}, ${phone}, ${email}, ${profilephoto}, ${emergencycontactname}, ${emergencycontactphone}, ${streetaddress}, ${suburb}, ${state}, ${postcode}, ${country})
            RETURNING *;
        `;
        console.log("Patient added successfully");
        res.status(201).json({success:true, data: newPatient[0]});
    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updatePatient = async (req, res) => {
    const { id } = req.params;
    const { name, age, dateofbirth, gender, phone, email, profilephoto, emergencycontactname, emergencycontactphone, streetaddress, suburb, state, postcode, country } = req.body;
    try {
        const updatedPatient = await sql`
            UPDATE patients
            SET Name = ${name}, Age = ${age}, DateOfBirth = ${dateofbirth}, Gender = ${gender}, Phone = ${phone}, Email = ${email}, ProfilePhoto = ${profilephoto}, EmergencyContactName = ${emergencycontactname}, EmergencyContactPhone = ${emergencycontactphone}, StreetAddress = ${streetaddress}, Suburb = ${suburb}, State = ${state}, Postcode = ${postcode}, Country = ${country}
            WHERE PID = ${id}
            RETURNING *;
        `;
        if (updatedPatient.length === 0) {
            return res.status(404).json({ message: "Patient not found" });
        }
        console.log("Patient updated successfully");
        res.status(200).json({success:true, data: updatedPatient[0]});
    } catch (error) {
        console.error("Error updating patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const deletePatient = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedPatient = await sql`
            DELETE FROM patients WHERE PID = ${id} RETURNING *;
        `;
        if (deletedPatient.length === 0) {
            return res.status(404).json({ message: "Patient not found" });
        }
        console.log("Patient deleted successfully");
        res.status(200).json({success:true, data: deletedPatient[0]});
    } catch (error) {
        console.error("Error deleting patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};