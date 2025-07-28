import path from "path";
import "dotenv/config";
import * as express from "express";
import express__default from "express";
import cors from "cors";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
const handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};
dotenv.config();
const { PGUSER, PGPASSWORD, PGHOST, PGDATABASE } = process.env;
const sql = neon(
  `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}?sslmode=require`
);
const getPatients = async (req, res) => {
  try {
    const patients = await sql`
            SELECT * FROM patients;
        `;
    console.log("Patients fetched successfully");
    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    console.error("Error getPatients function: ", error);
    res.status(500).json({ message: "server error" });
  }
};
const getPatientById = async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await sql`
            SELECT * FROM patients WHERE id = ${id};
        `;
    if (patient.length === 0) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }
    console.log("Patient fetched successfully");
    res.status(200).json({ success: true, data: patient[0] });
  } catch (error) {
    console.error("Error getPatientById function: ", error);
    res.status(500).json({ message: "server error" });
  }
};
const createPatient = async (req, res) => {
  try {
    const { name, age, gender, phone, email, profilephoto } = req.body;
    const patient = await sql`
            INSERT INTO patients (name, age, gender, phone, email, profilephoto)
            VALUES (${name}, ${age}, ${gender}, ${phone}, ${email}, ${profilephoto})
            RETURNING *;
        `;
    console.log("Patient created successfully");
    res.status(201).json({ success: true, data: patient });
  } catch (error) {
    console.error("Error createPatient function: ", error);
    res.status(500).json({ message: "server error" });
  }
};
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, gender, phone, email, profilephoto } = req.body;
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
      res.status(404).json({ message: "Patient not found" });
      return;
    }
    console.log("Patient updated successfully, ID:", id);
    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Error updatePatient function: ", error);
    res.status(500).json({ message: "server error" });
  }
};
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await sql`
            DELETE FROM patients WHERE id = ${id} RETURNING *;
        `;
    if (patient.length === 0) {
      res.status(404).json({ message: "Patient not found" });
      return;
    }
    console.log("Patient deleted successfully, ID:", id);
    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Error deletePatient function: ", error);
    res.status(500).json({ message: "server error" });
  }
};
const router = express__default.Router();
router.get("/", getPatients);
router.get("/:id", getPatientById);
router.post("/", createPatient);
router.put("/:id", updatePatient);
router.delete("/:id", deletePatient);
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  app2.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app2.get("/api/demo", handleDemo);
  app2.use("/api/patients", router);
  return app2;
}
const app = createServer();
const port = process.env.PORT || 3e3;
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map
