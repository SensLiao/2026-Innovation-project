import { sql } from "../config/db.js";

export const getReportNum = async (req, res) => {
    try {
        const reportNum = await sql`
            SELECT COUNT(id) as count
            FROM diagnosis_records;
        `;
        console.log("REPORT counted successfully");
        res.status(200).json({success:true, data: reportNum[0].count});
    } catch (error) {
        console.error("Error counting reports:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getDraftNum = async (req, res) => {
    try {
        const draftNum = await sql`
            SELECT COUNT(id) as count
            FROM diagnosis_records
            WHERE status = 'DRAFT_READY';
        `;
        console.log("DRAFT REPORT counted successfully");
        res.status(200).json({success:true, data: draftNum[0].count});
    } catch (error) {
        console.error("Error counting draft reports:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getReviseNum = async (req, res) => {
    try {
        const reviseNum = await sql`
            SELECT COUNT(id) as count
            FROM diagnosis_records
            WHERE status = 'REVISING';
        `;
        console.log("REVISING REPORT counted successfully");
        res.status(200).json({success:true, data: reviseNum[0].count});
    } catch (error) {
        console.error("Error counting revising reports:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const getApprovedNum = async (req, res) => {
    try {
        const approvedNum = await sql`
            SELECT COUNT(id) as count
            FROM diagnosis_records
            WHERE status = 'APPROVED';
        `;
        console.log("APPROVED REPORT counted successfully");
        res.status(200).json({success:true, data: approvedNum[0].count});
    } catch (error) {
        console.error("Error counting approved reports:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getDraftThisWeek = async (req, res) => {
    try {
        // Calculate Monday of current week (start of week) in UTC
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(today);
        weekStart.setUTCDate(today.getUTCDate() - daysToMonday);
        weekStart.setUTCHours(0, 0, 0, 0);

        const draftThisWeek = await sql`
            SELECT COUNT(id) as count FROM diagnosis_records
            WHERE status = 'DRAFT_READY' AND createdat >= ${weekStart.toISOString()}
        `;
        
        console.log("Draft reports this week counted successfully");
        res.status(200).json({success: true, data: draftThisWeek[0].count});
    } catch (error) {
        console.error("Error counting draft reports this week:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getReviseThisWeek = async (req, res) => {
    try {
        // Calculate Monday of current week (start of week) in UTC
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(today);
        weekStart.setUTCDate(today.getUTCDate() - daysToMonday);
        weekStart.setUTCHours(0, 0, 0, 0);

        const reviseThisWeek = await sql`
            SELECT COUNT(id) as count FROM diagnosis_records
            WHERE status = 'REVISING' AND createdat >= ${weekStart.toISOString()}
        `;
        
        console.log("Revising reports this week counted successfully");
        res.status(200).json({success: true, data: reviseThisWeek[0].count});
    } catch (error) {
        console.error("Error counting revising reports this week:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getApprovedThisWeek = async (req, res) => {
    try {
        // Calculate Monday of current week (start of week) in UTC
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(today);
        weekStart.setUTCDate(today.getUTCDate() - daysToMonday);
        weekStart.setUTCHours(0, 0, 0, 0);

        const approvedThisWeek = await sql`
            SELECT COUNT(id) as count FROM diagnosis_records
            WHERE status = 'APPROVED' AND createdat >= ${weekStart.toISOString()}
        `;
        
        console.log("Approved reports this week counted successfully");
        res.status(200).json({success: true, data: approvedThisWeek[0].count});
    } catch (error) {
        console.error("Error counting approved reports this week:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};