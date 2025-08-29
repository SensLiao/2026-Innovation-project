import React, { useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import main from "../assets/images/Main.png";
import Decoration from "../assets/images/main2.png";
import "./patient.css";

// Professional icons
import {
  Edit3,
  Save as SaveIcon,
  Download,
  Copy,
  Printer,
  Code2,
} from "lucide-react";

/* ------------ CHIPS ------------ */
function Chip({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ---------------------------------------------  TOOLBAR ------------------------------------------------ */
function ReportToolbar() {
  const items = [
    { Icon: Edit3, label: "Edit" },
    { Icon: SaveIcon, label: "Save" },
    { Icon: Download, label: "Download" },
    { Icon: Copy, label: "Duplicate" },
    { Icon: Printer, label: "Print/PDF" },
    { Icon: Code2, label: "View JSON" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {items.map(({ Icon, label }, i) => (
        <button
          key={i}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium
                     text-gray-700 bg-white hover:bg-gray-50 shadow-sm whitespace-nowrap"
          type="button"
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------- REPORT PANEL ------------------------------------------------ */
function ReportPanel({ reportText, onChangeText, model, onChangeModel }) {
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Compact toolbar*/}
      <ReportToolbar />

      {/* Title */}
      <h2 className="text-center text-4xl md:text-3xl font-extrabold tracking-tight">Medical Report</h2>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="green">CT</Chip>
        <Chip>Chest</Chip>

        {/* Model info */}
        <span className="flex items-center gap-1 text-sm text-gray-700">

          <Chip tone="blue">Model: SOMA-CT-v1</Chip>
        </span>

        <Chip tone="blue">generated: {ts}</Chip>
        <Chip tone="blue">single_image_only</Chip>
        <Chip tone="blue">incomplete_series</Chip>
        <Chip tone="blue">windowing_limited</Chip>
        <Chip tone="blue">needs_clinical_correlation</Chip>
      </div>


      {/* Section label */}
      <div className="text-center font-semibold text-gray-700">ROI Preview (Canvas)</div>

      {/* Canvas preview */}
      <div className="rounded-xl border bg-gray-50 p-3">
        <div className="h-[250px] w-full rounded-lg bg-white shadow-inner grid place-items-center">
          <span className="text-gray-400 text-sm">Canvas preview</span>
        </div>
      </div>

      {/* ----------------------------------------- Report body -----------------------------------------------*/}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-600">Report</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChangeText(sampleGeneratedReport)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Medical Report
            </button>
            <button
              type="button"
              onClick={() => onChangeText(defaultReport)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Formal Report
            </button>
          </div>
        </div>

        <textarea
          value={reportText}
          onChange={(e) => onChangeText(e.target.value)}
          className="h-64 w-full resize-none rounded-lg border p-3 text-sm text-gray-800 focus:ring-2 focus:ring-blue-200"
        />
      </div>

    </div>
  );
}

/* ------------------------------------------------ PAGE ------------------------------------------------ */
const SegmentationPage = () => {
  const [activeTab, setActiveTab] = useState("segmentation");
  const [fileName, setFileName] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reportText, setReportText] = useState(defaultReport);
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("SOMA-CT-v1");
  const [mode, setMode] = useState("foreground");
  const [tool, setTool] = useState("point");
  const inputRef = useRef(null);

  // Handle file dropped into upload area
  function handleDrop(e) {
    e.preventDefault();  // prevent browser from opening file
    const f = e.dataTransfer.files?.[0]; // get the first dropped file
    if (f) handleFile(f); // pass file to handler
  }

  // Trigger hidden <input type="file" /> when "Browse" is clicked
  function handleBrowse() {
    inputRef.current?.click();
  }

  // Process selected file
  function handleFile(f) {
    setFileName(f.name);
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1200);
    }, 900);
  }

  // Run segmentation model (simulate async process)
  function runModel() {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setReportText(sampleGeneratedReport); // replace report text with sample
    }, 1100);
  }

  // Reset uploaded image
  function resetImage() {
    setFileName(null);
  }

  // Segmentation options (radio buttons)
  const segOptions = useMemo(
    () => [
      { id: "foreground", label: "Foreground segmentation" },
      { id: "background", label: "Background segmentation" },
    ],
    []
  );

  // Tool options (radio buttons)
  const toolOptions = useMemo(
    () => [
      { id: "point", label: "Point" },
      { id: "box", label: "Box" },
      { id: "everything", label: "Everything" },
    ],
    []
  );

  return (
    // Page container with blue background
    <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">

      {/* Success popup (appears after file upload) */}
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-100 border border-green-300 text-green-800 px-5 py-2 rounded-lg shadow z-50">
          Image processed successfully
        </div>
      )}

      {/* Main centered content container */}
      <div className="relative w-full max-w-6xl">

        {/* Decorative blobs */}
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        {/* White sheet */}
        <div className="bg-white rounded-3xl shadow-2xl px-6 md:px-12 py-8 md:py-14 relative min-h-[90vh] pb-24">

          {/* Overlay spinner when model is running */}
          {isRunning && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30 rounded-3xl">
              <div className="mr-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              <span className="text-blue-700 font-medium">Working…</span>
            </div>
          )}

          {/* Header */}
          <Header activeTab="segmentation" showLogout />

          {/* Title + Illustration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-10 md:mt-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-extrabold text-[#3B82F6] leading-none">
                SOMA <span className="text-black text-4xl md:text-5xl font-semibold">Health</span>
              </h1>
              <div className="mt-4 text-gray-500 text-lg">
                <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle mr-3" />
                <span className="align-middle">Segmentation</span>
                <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle ml-3" />
              </div>
            </div>
            <img
              src={main}
              alt="Illustration"
              className="w-[450px] object-contain justify-self-end pointer-events-none select-none"
            />
          </div>

          {/* ------------------------ Workspace: LEFT 3/5, RIGHT 2/5 ------------------------------ */}
          <div className="mt-10 flex flex-col md:flex-row gap-6">

            {/* ---------------------------------- Left: Segmentation ---------------------------------------- */}
            <div className="md:basis-3/5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              {/* Tabs: Segmentation / Report */}
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("segmentation")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm ${
                    activeTab === "segmentation" ? "bg-blue-600/90 text-white" : "bg-gray-300 text-gray-700"
                  }`}
                >
                  Segmentation
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm ${
                    activeTab === "report" ? "bg-blue-600/90 text-white" : "bg-gray-300 text-gray-700"
                  }`}
                >
                  Report
                </button>
              </div>

              {activeTab === "segmentation" ? (
                <>
                  {/* Upload area */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={handleBrowse}
                    className="group relative flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*,.dcm"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                    <div className="mb-2 text-gray-600">Drag the image here to upload</div>
                    <button className="rounded-full bg-blue-600 px-4 py-1.5 text-white text-sm font-semibold shadow hover:bg-blue-700">
                      {fileName ? "Replace" : "File"}
                    </button>
                    {fileName && <p className="mt-2 line-clamp-1 text-xs text-gray-500">{fileName}</p>}
                  </div>

                  {/* Tools row */}
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {/* Segmentation mode */}
                    <fieldset className="col-span-2 flex flex-wrap items-center gap-3">
                      <legend className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Segmentation
                      </legend>
                      {segOptions.map((opt) => (
                        <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="radio"
                            name="mode"
                            value={opt.id}
                            checked={mode === opt.id}
                            onChange={() => setMode(opt.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </fieldset>

                    {/* Tool */}
                    <fieldset className="col-span-2 flex flex-wrap items-center gap-3">
                      <legend className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Tool
                      </legend>
                      {toolOptions.map((opt) => (
                        <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="radio"
                            name="tool"
                            value={opt.id}
                            checked={tool === opt.id}
                            onChange={() => setTool(opt.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </fieldset>

                    {/* Run / Undo / Reset */}
                    <div className="col-span-2 md:col-span-1 flex items-center">
                      <button
                        onClick={runModel}
                        className="w-full h-11 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                        disabled={!fileName}
                        title="Run model"
                      >
                        Run Model
                      </button>
                    </div>
                    <div className="col-span-2 md:col-span-1 flex gap-2 min-w-0">
                      <button className="flex-1 min-w-[130px] h-11 rounded-full border px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                        Undo Points
                      </button>
                      <button
                        onClick={resetImage}
                        className="flex-1 min-w-[130px] h-11 rounded-full border px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        Reset Image
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <ReportPanel
                  reportText={reportText}
                  onChangeText={setReportText}
                  model={model}
                  onChangeModel={setModel}
                />
              )}
            </div>

            {/* ---------------------------------------- Right: Chat  ---------------------------------------- */}
            <div className="md:basis-2/5 rounded-2xl border bg-white p-4 shadow-sm flex flex-col h-[560px]">
              {/* TOP: Chat box */}
              <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-3">
                <div className="mb-2 flex justify-end">
                  <div className="max-w-[75%] rounded-full bg-blue-100 px-4 py-2 text-sm text-gray-800">
                    Can you generate report for this CT
                  </div>
                </div>
                <div className="mb-2 flex justify-start">
                  <div className="max-w-[75%] w-full rounded-2xl bg-white px-4 py-2 text-sm text-gray-900 border text-left">
                    All set! I’ve created a report for this CT.
                  </div>
                </div>
              </div>

              {/* MIDDLE: Tools bar */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border 
                                text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Add"
                    >+</button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border 
                                text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Settings"
                    >⚙</button>
                    Models
                  </span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="rounded-md border px-2 py-1 text-sm text-gray-700 focus:outline-none"
                  >
                    <option value="SOMA-CT-v1">SOMA-CT-v1</option>
                    <option value="SOMA-CT-v2">SOMA-CT-v2</option>
                    <option value="General-4o-mini">General-4o-mini</option>
                  </select>
                </div>

                {/* Added ml-3 here */}
                <button
                  onClick={runModel}
                  className="ml-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  Analyse
                </button>
              </div>


              {/* BOTTOM: Input */}
              <div className="mt-3 flex items-start gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your questions…"
                  className="flex-1 h-28 resize-none rounded-xl border bg-blue-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={() => { setQuestion(""); runModel(); }}
                  className="h-10 shrink-0 rounded-md border px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Send
                </button>
              </div>
            </div>
            {/* /Right */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentationPage;

/* ------------------------------ SAMPLE REPORT TEXTS ------------------------------------ */
const defaultReport = `Formal Report

Patient: Smith, Jane; 54 F; MRN 123456
Accession: CCT-987654; Site: SOMA Health Imaging
Exam Date/Time: 09 Aug 2025 14:17
Referrer: Dr. A Nguyen (Oncology)

Examination:
CT chest, abdomen and pelvis with IV contrast.

Clinical Indication:
Unexplained weight loss and anemia. Query occult malignancy.`;

const sampleGeneratedReport = `Medical Report

TECHNIQUE: Contrast-enhanced CT of chest/abdomen/pelvis.

FINDINGS:
• Lungs: No focal consolidation. Small 4 mm nodule RUL, indeterminate.
• Liver: Mild steatosis. No focal lesion.
• Lymph nodes: No pathologic adenopathy.
• Other: No free fluid or free air.

IMPRESSION:
1) No acute CT abnormality.
2) 4 mm indeterminate pulmonary nodule; consider 12-month interval follow-up if risk factors present.`;
