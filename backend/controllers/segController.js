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


