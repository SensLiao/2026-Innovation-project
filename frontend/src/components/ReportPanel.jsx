import React from "react";
import { Edit3, Save as SaveIcon, Download, Copy, Printer, Code2 } from "lucide-react";

/** Small rounded label */
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

/** Toolbar above the report */
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
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm whitespace-nowrap"
          type="button"
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * ReportPanel – extracted standalone component
 *
 * @param {Object} props
 * @param {string} props.reportText
 * @param {(t: string) => void} props.onChangeText
 * @param {string} props.model
 * @param {(m: string) => void} [props.onChangeModel]
 * @param {{ medical: string, formal: string }} [props.samples]
 */
export default function ReportPanel({ reportText, onChangeText, model, onChangeModel, samples }) {
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
          <Chip tone="blue">Model: {model}</Chip>
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
              onClick={() => samples?.medical && onChangeText(samples.medical)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Medical Report
            </button>
            <button
              type="button"
              onClick={() => samples?.formal && onChangeText(samples.formal)}
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