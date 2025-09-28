import React, { useEffect, useRef, useState } from "react";
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
function ReportToolbar({ onEdit, onSave, onDownload, onDuplicate, onPrint, onViewJSON }) {
  const items = [
    { Icon: Edit3, label: "Edit", onClick: onEdit },
    { Icon: SaveIcon, label: "Save", onClick: onSave },
    { Icon: Download, label: "Download", onClick: onDownload },
    { Icon: Copy, label: "Duplicate", onClick: onDuplicate },
    { Icon: Printer, label: "Print/PDF", onClick: onPrint },
    { Icon: Code2, label: "View JSON", onClick: onViewJSON },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {items.map(({ Icon, label, onClick }, i) => (
        <button
          key={i}
          onClick={onClick}
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
 * @param {string|null} [props.uploadedImage]   dataURL
 * @param {number[]|Float32Array|null} [props.maskOutput]  length = H*W
 * @param {[number, number]|null} [props.maskDims]         [H, W]
 * @param {[number, number]|null} [props.origImSize]       [H, W] of original image
 */
export default function ReportPanel({
  reportText,
  onChangeText,
  model,
  onChangeModel,
  samples,
  uploadedImage,
  maskOutput,
  maskDims,
  origImSize,
}) {
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ===== local states & refs =====
  const [isEditing, setIsEditing] = useState(true);
  const [showJSON, setShowJSON] = useState(false);
  const textAreaRef = useRef(null);

  // Canvas refs
  const hostRef = useRef(null);   // 包裹 h-[250px] 的 div
  const canvasRef = useRef(null); // 真正绘制的画布

  // ===== 在 ROI 预览区域渲染 “图片 + 掩码” 叠加 =====
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;

    if (!host || !canvas) return;

    // 条件不足时清空 & 返回
    if (!uploadedImage || !maskOutput || !maskDims || !origImSize) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // 读取容器和 DPR
    const contW = host.clientWidth;
    const contH = host.clientHeight; // tailwind 固定 h-[250px]
    if (!contW || !contH) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(contW * dpr);
    canvas.height = Math.round(contH * dpr);
    canvas.style.width = `${contW}px`;
    canvas.style.height = `${contH}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, contW, contH);

    // 原图尺寸（H, W）
    const [natH, natW] = origImSize;
    if (!natH || !natW) return;

    // 计算 object-contain 后的显示矩形
    const scale = Math.min(contW / natW, contH / natH);
    const drawW = Math.round(natW * scale);
    const drawH = Math.round(natH * scale);
    const offsetX = Math.round((contW - drawW) / 2);
    const offsetY = Math.round((contH - drawH) / 2);

    // 1) 绘制底图
    const im = new Image();
    im.onload = () => {
      ctx.drawImage(im, offsetX, offsetY, drawW, drawH);

      // 2) 绘制掩码（与 Segmentation 一致：DodgerBlue + 60% 透明）
      const [mH, mW] = maskDims;
      const maskArr = Array.isArray(maskOutput) ? maskOutput : Array.from(maskOutput);
      if (maskArr.length !== mH * mW) return;

      const temp = document.createElement("canvas");
      temp.width = mW;
      temp.height = mH;
      const tctx = temp.getContext("2d");
      const imgData = tctx.createImageData(mW, mH);

      const R = 30, G = 144, B = 255, A = 153; // 60% alpha
      for (let i = 0; i < maskArr.length; i++) {
        const on = Number(maskArr[i]) > 0.5;
        const off = i * 4;
        imgData.data[off] = R;
        imgData.data[off + 1] = G;
        imgData.data[off + 2] = B;
        imgData.data[off + 3] = on ? A : 0;
      }
      tctx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, offsetX, offsetY, drawW, drawH);
    };
    im.src = uploadedImage;

  }, [uploadedImage, maskOutput, maskDims, origImSize]);

  // 窗口大小变化时，重绘一次（保持清晰）
  useEffect(() => {
    const onResize = () => {
      if (!hostRef.current || !canvasRef.current) return;
      const host = hostRef.current;
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const contW = host.clientWidth;
      const contH = host.clientHeight;
      canvas.width = Math.round(contW * dpr);
      canvas.height = Math.round(contH * dpr);
      canvas.style.width = `${contW}px`;
      canvas.style.height = `${contH}px`;
      // 触发上面的 effect 重新绘制（依赖数组里有 uploadedImage 等，会自动走一遍）
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ====== Button handlers ======
  function handleEdit() {
    setIsEditing((v) => {
      const next = !v;
      // 如果进入编辑状态，聚焦文本域
      if (next) {
        setTimeout(() => textAreaRef.current?.focus(), 0);
      }
      return next;
    });
  }

  function handleSave() {
    try {
      const payload = {
        model,
        timestamp: new Date().toISOString(),
        text: reportText,
      };
      // 最近一次
      localStorage.setItem("soma_report_last", JSON.stringify(payload));
      // 追加到历史
      const hist = JSON.parse(localStorage.getItem("soma_report_history") || "[]");
      hist.push(payload);
      localStorage.setItem("soma_report_history", JSON.stringify(hist));
      alert("Report saved locally.");
    } catch (e) {
      console.error("Save failed:", e);
      alert("Save failed. Check console.");
    }
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleDownload() {
    const safeTs = ts.replace(/[:]/g, "-").replace(/\s+/g, "_");
    const header = [
      `Model: ${model}`,
      `Generated: ${ts}`,
      `HasMask: ${!!(maskOutput && maskDims)}`,
      `MaskDims: ${maskDims ? maskDims.join("x") : "-"}`,
      "",
      "=== Report ===",
      "",
    ].join("\n");
    const content = `${header}${reportText || ""}\n`;
    downloadTextFile(`SOMA_Report_${safeTs}_${model}.txt`, content);
  }

  async function handleDuplicate() {
    try {
      await navigator.clipboard.writeText(reportText || "");
      alert("Report copied to clipboard.");
    } catch (e) {
      console.warn("Clipboard API failed; fallback to prompt.", e);
      // 退化方案
      window.prompt("Copy the report text:", reportText || "");
    }
  }

  function handlePrint() {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;

    // 若有 ROI 画布，把它导出一张 PNG 嵌入打印页
    let previewImgTag = "";
    try {
      const dataUrl = canvasRef.current?.toDataURL?.("image/png");
      if (dataUrl) {
        previewImgTag = `<img src="${dataUrl}" style="max-width:100%;border:1px solid #eee;border-radius:8px" />`;
      }
    } catch (e) {
      // ignore
    }

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>SOMA Report</title>
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px; }
            .meta { color:#555; margin-bottom: 16px; font-size: 12px; }
            .section { margin: 16px 0; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; background:#fafafa; border:1px solid #eee; padding:12px; border-radius:8px; }
          </style>
        </head>
        <body>
          <h1>SOMA Medical Report</h1>
          <div class="meta">
            <div><strong>Model:</strong> ${model}</div>
            <div><strong>Generated:</strong> ${ts}</div>
            <div><strong>Has Mask:</strong> ${!!(maskOutput && maskDims)}</div>
            <div><strong>Mask Dims:</strong> ${maskDims ? maskDims.join(" x ") : "-"}</div>
          </div>

          <div class="section">
            <h2>ROI Preview</h2>
            ${previewImgTag || "<div style='color:#888'>No preview</div>"}
          </div>

          <div class="section">
            <h2>Report</h2>
            <pre>${(reportText || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function handleViewJSON() {
    setShowJSON((v) => !v);
  }

  // 供 View JSON 使用的精简信息（不内联整张 base64 图，避免过大）
  const jsonMeta = {
    model,
    generated_at: ts,
    has_mask: !!(maskOutput && maskDims),
    mask_dims: maskDims || null,
    image_present: !!uploadedImage,
    report_chars: (reportText || "").length,
  };

  return (
    <div className="space-y-4">
      {/* Compact toolbar*/}
      <ReportToolbar
        onEdit={handleEdit}
        onSave={handleSave}
        onDownload={handleDownload}
        onDuplicate={handleDuplicate}
        onPrint={handlePrint}
        onViewJSON={handleViewJSON}
      />

      {/* 轻量 JSON 折叠视图（不改变既有布局层级，仅在工具栏下方加一块） */}
      {showJSON && (
        <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-700 overflow-auto">
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(jsonMeta, null, 2)}
          </pre>
        </div>
      )}

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
        <div
          ref={hostRef}
          className="h-[250px] w-full rounded-lg bg-white shadow-inner grid place-items-center"
        >
          {uploadedImage && maskOutput && maskDims ? (
            /* 放一个充满容器的画布，实际绘制在 useEffect 里 */
            <canvas ref={canvasRef} className="h-full w-full" />
          ) : (
            <span className="text-gray-400 text-sm">Canvas preview</span>
          )}
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
          ref={textAreaRef}
          value={reportText}
          onChange={(e) => onChangeText(e.target.value)}
          readOnly={!isEditing}
          className={`h-64 w-full resize-none rounded-lg border p-3 text-sm text-gray-800 focus:ring-2 focus:ring-blue-200 ${
            !isEditing ? "bg-gray-50" : "bg-white"
          }`}
        />
      </div>
    </div>
  );
}
