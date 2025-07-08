# 2026-Innovation-project
This is a medical image analysis and disease prediction
## Project Overview
- Frontend: React + Canvas
- Backend: Node.js + Express
- Inference: ONNX Runtime Web (client-side)
- Optional: LLM-based reporting

---

## Agent Role Prompt

You are a full-stack AI assistant.

Given the project goal to build a medical image segmentation web app using client-side ONNX model inference (SAM2), your job is to:

1. Generate React components for uploading and interacting with medical images.
2. Load and run SAM2 (ONNX format) using `onnxruntime-web` in-browser.
3. (Optional) Build a backend endpoint to receive segmentation metadata and call an LLM API to generate a report.
4. Ensure that inference remains client-side to protect user privacy.

Please follow modern JavaScript practices and keep all components modular and minimal.

---

## Example Tasks

- "Create a simple React component for image upload and click-based prompt input."
- "Load a SAM2 ONNX model in the browser and return a mask overlay."
- "Build a REST endpoint `/report` that accepts metadata and returns a sample text."
- "Define a minimal PostgreSQL table for storing image analysis records."

---

Use this template for code generation, prototyping, or scaffolding.
