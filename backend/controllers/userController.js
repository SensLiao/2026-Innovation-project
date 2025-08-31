import { sql } from "../config/db.js";

export const getUsers = async (req, res) => {
    try {
        const users = await sql`
            SELECT * FROM users
            ORDER BY UID DESC;
        `;
        console.log("Users fetched successfully");
        res.status(200).json({success:true, data: users});
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserByID = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await sql`
            SELECT * FROM users WHERE UID = ${id};
        `;
        if (user.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        console.log("User fetched successfully");
        res.status(200).json({success:true, data: user[0]});
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const addUser = async (req, res) => {
    const { name, email, phone, passwordhash, profilephoto, yearofexperience, education, languages } = req.body;
    try {
        const newUser = await sql`
            INSERT INTO users (Name, Email, Phone, PasswordHash, ProfilePhoto, YearOfExperience, Education, Languages)
            VALUES (${name}, ${email}, ${phone}, ${passwordhash}, ${profilephoto}, ${yearofexperience}, ${education}, ${languages})
            RETURNING *;
        `;
        console.log("User added successfully");
        res.status(201).json({success:true, data: newUser[0]});
    } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, passwordhash, profilephoto, yearofexperience, education, languages } = req.body;
    try {
        const updatedUser = await sql`
            UPDATE users
            SET Name = ${name}, Email = ${email}, Phone = ${phone}, PasswordHash = ${passwordhash}, ProfilePhoto = ${profilephoto}, YearOfExperience = ${yearofexperience}, Education = ${education}, Languages = ${languages}
            WHERE UID = ${id}
            RETURNING *;
        `;
        if (updatedUser.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        console.log("User updated successfully");
        res.status(200).json({success:true, data: updatedUser[0]});
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUser = await sql`
            DELETE FROM users WHERE UID = ${id} RETURNING *;
        `;
        if (deletedUser.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        console.log("User deleted successfully");
        res.status(200).json({success:true, data: deletedUser[0]});
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}