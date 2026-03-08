import { sql } from "../config/db.js";

export const getSegs = async (req, res) => {
    try {
        const segmentations = await sql`
            SELECT * FROM segmentations
            ORDER BY createdat DESC;
        `;
        console.log("Segmentations fetched successfully");
        res.status(200).json({success:true, data: segmentations});
    } catch (error) {
        console.error("Error fetching segmentations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getSegByID = async (req, res) => {
    const { id } = req.params;
    try {
        const segmentations = await sql`
            SELECT * 
            FROM segmentations 
            WHERE SID = ${id};
        `;
        if (segmentations.length === 0) {
            return res.status(404).json({ message: "Segmentation not found" });
        }
        console.log("Segmentation fetched successfully");
        res.status(200).json({success:true, data: segmentations[0]});
    } catch (error) {
        console.error("Error fetching segmentation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const addSeg = async (req, res) => {
    const { uid, pid, model, uploadimage, origimsize, masks } = req.body;
    try {
        // ---- 规范化 masks（确保 TypedArray 转为普通 Array，避免 JSON 序列化问题）----
        const normalizeMask = (m) => {
            const obj = { ...m };
            // 把 mask 字段转换成普通数组（若已是数组就原样返回）
            if (obj && obj.mask != null && ArrayBuffer.isView(obj.mask)) {
                obj.mask = Array.from(obj.mask);
            }
            return obj;
        };
        const normalizedMasks = masks.map(normalizeMask);

        const newSegmentation = await sql`
            INSERT INTO segmentations (uid, pid, model, uploadimage, origimsize, masks)
            VALUES (${uid}, ${pid}, ${model}, ${uploadimage}, ${origimsize}, ${JSON.stringify(normalizedMasks)}::jsonb)
            RETURNING *;
        `;
        console.log("Segmentation added successfully");
        res.status(201).json({success:true, data: newSegmentation[0]});
    } catch (error) {
        console.error("Error adding segmentation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}



export const getSegNum = async (req, res) => {
    try {
        const segNum = await sql`
            SELECT COUNT(sid) as count FROM segmentations;
        `;
        console.log("CT Scans / Segmentation counted successfully");
        res.status(200).json({success:true, data: segNum[0].count});
    } catch (error) {
        console.error("Error counting segmentations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const getSegThisWeek = async (req, res) => {
    try {
        // Calculate Monday of current week (start of week) in UTC
        const today = new Date();
        const dayOfWeek = today.getUTCDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(today);
        weekStart.setUTCDate(today.getUTCDate() - daysToMonday);
        weekStart.setUTCHours(0, 0, 0, 0);

        const segThisWeek = await sql`
            SELECT COUNT(sid) as count FROM segmentations
            WHERE createdat >= ${weekStart.toISOString()}
        `;
        
        console.log("Segmentations registered this week counted successfully");
        res.status(200).json({success: true, data: segThisWeek[0].count});
    } catch (error) {
        console.error("Error counting segmentations this week:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};