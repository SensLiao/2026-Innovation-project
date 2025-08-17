import { sql } from "../config/db.js";

export const getPub = async (req, res) => {
    const { uid } = req.params;
    try {
        const publications = await sql`
            SELECT * FROM publication
            WHERE UID = ${uid}
            ORDER BY PublicationDate DESC;
        `;
        console.log("Publications fetched successfully");
        res.status(200).json({success:true, data: publications});
    } catch (error) {
        console.error("Error fetching publications:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const addPub = async (req, res) => {
    const { uid } = req.params;
    if (!uid) {
        return res.status(400).json({ message: "User ID is required" });
    }
    const { title, description, author, publicationdate, link } = req.body;
    try {
        const newPublication = await sql`
            INSERT INTO publication (Title, Description, Author, PublicationDate, Link, UID)
            VALUES (${title}, ${description}, ${author}, ${publicationdate}, ${link}, ${uid})
            RETURNING *;
        `;
        console.log("Publication added successfully");
        res.status(201).json({success:true, data: newPublication[0]});
    } catch (error) {
        console.error("Error adding publication:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updatePub = async (req, res) => {
    const { pid } = req.params;
    const { title, description, author, publicationdate, link } = req.body;
    try {
        const updatedPublication = await sql`
            UPDATE publication
            SET Title = ${title}, Description = ${description}, Author = ${author}, PublicationDate = ${publicationdate}, Link = ${link}
            WHERE PID = ${pid}
            RETURNING *;
        `;
        if (updatedPublication.length === 0) {
            return res.status(404).json({ message: "Publication not found" });
        }
        console.log("Publication updated successfully");
        res.status(200).json({success:true, data: updatedPublication[0]});
    } catch (error) {
        console.error("Error updating publication:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const deletePub = async (req, res) => {
    const { pid } = req.params;
    try {
        const deletedPublication = await sql`
            DELETE FROM publication
            WHERE PID = ${pid}
            RETURNING *;
        `;
        if (deletedPublication.length === 0) {
            return res.status(404).json({ message: "Publication not found" });
        }
        console.log("Publication deleted successfully");
        res.status(200).json({success:true, data: deletedPublication[0]});
    } catch (error) {
        console.error("Error deleting publication:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}