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

