import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Edit3, Save as SaveIcon, Download, Copy, Printer, Code2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
    { Icon: Printer, label: "Export PDF", onClick: onPrint },
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
 * ReportPanel – standalone component (with robust PDF export)
 *
 * @param {Object} props
 * @param {string} props.reportText
 * @param {(t: string) => void} props.onChangeText
 * @param {string} props.model
 * @param {(m: string) => void} [props.onChangeModel]
 * @param {{ medical: string, formal: string }} [props.samples]
 * @param {string|null} [props.uploadedImage]   dataURL
 * @param {Array|null} [props.masks]  array of mask objects { mask, maskDims, visible, color, name }
 * @param {[number, number]|null} [props.origImSize]       [H, W] of original image
 */
export default function ReportPanel({
  reportText,
  onChangeText,
  model,
  onChangeModel,
  samples,
  uploadedImage,
  masks,
  origImSize,
}) {
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ===== local states & refs =====
  const [isEditing, setIsEditing] = useState(false);  // Default to view mode with markdown rendering
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
    if (!uploadedImage || !masks || masks.length === 0 || !origImSize) {
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

      // 2) 绘制所有可见掩码（按传入 masks 顺序，颜色由 mask.color 或默认表决定）
      const defaultColors = ["#1E90FF","#00BFFF","#7FFF00","#FFD700","#FF7F50","#FF1493","#8A2BE2"];
      masks.forEach((mObj, idx) => {
        if (!mObj || !mObj.visible || !mObj.mask || !mObj.maskDims) return;
        const [mH, mW] = mObj.maskDims;
        const maskArr = Array.isArray(mObj.mask) ? mObj.mask : Array.from(mObj.mask);
        if (maskArr.length !== mH * mW) return;

        const temp = document.createElement("canvas");
        temp.width = mW;
        temp.height = mH;
        const tctx = temp.getContext("2d");
        const imgData = tctx.createImageData(mW, mH);

        const hex = (mObj.color || defaultColors[idx % defaultColors.length]).replace('#','');
        const R = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.slice(0,2),16);
        const G = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.slice(2,4),16);
        const B = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.slice(4,6),16);
        const A = 153; // 60% alpha
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
      });
    };
    im.src = uploadedImage;

  }, [uploadedImage, masks, origImSize]);

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
      // 上面的主绘制 effect 会因依赖（尺寸影响）而再次执行
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ====== Button handlers ======
  function handleEdit() {
    setIsEditing((v) => {
      const next = !v;
      if (next) setTimeout(() => textAreaRef.current?.focus(), 0);
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
      localStorage.setItem("soma_report_last", JSON.stringify(payload));
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
      `HasMask: ${!!(masks && masks.length > 0)}`,
      `MaskCount: ${masks ? masks.length : 0}`,
      `MaskDims: ${masks && masks[0]?.maskDims ? masks[0].maskDims.join("x") : "-"}`,
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
      window.prompt("Copy the report text:", reportText || "");
    }
  }

  /** Robust PDF export: html2canvas + jsPDF, with paging and image scaling */
  async function handlePrint() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    let cursorY = margin + 6;

    // Title and meta
    doc.setFontSize(16);
    doc.text("SOMA Medical Report", margin, cursorY);
    cursorY += 8;
    doc.setFontSize(10);
    doc.text(`Model: ${model}`, margin, cursorY); cursorY += 5;
    doc.text(`Generated: ${ts}`, margin, cursorY); cursorY += 8;

    // ROI image (screenshot the preview host; fallback to the internal canvas)
    const addRoiImage = async () => {
      try {
        let dataUrl = "";
        if (hostRef.current) {
          const snap = await html2canvas(hostRef.current, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: "#ffffff",
            scale: 2,
            logging: false,
          });
          dataUrl = snap.toDataURL("image/png");
        } else if (canvasRef.current?.toDataURL) {
          dataUrl = canvasRef.current.toDataURL("image/png");
        }
        if (!dataUrl) return;

        const imgProps = doc.getImageProperties(dataUrl);
        const targetW = pageW - margin * 2;
        const targetH = (imgProps.height * targetW) / imgProps.width;

        if (cursorY + targetH > pageH - margin) {
          doc.addPage(); cursorY = margin;
        }
        doc.addImage(dataUrl, "PNG", margin, cursorY, targetW, targetH);
        cursorY += targetH + 6;
      } catch (err) {
        console.warn("ROI preview render failed, continue without image", err);
      }
    };
    await addRoiImage();

    // Body (wrap & paginate)
    const addBodyText = (text) => {
      doc.setFontSize(12);
      const maxWidth = pageW - margin * 2;
      const lines = doc.splitTextToSize(text || "", maxWidth);
      const lineHeight = 5.2; // mm
      for (let i = 0; i < lines.length; i++) {
        if (cursorY + lineHeight > pageH - margin) {
          doc.addPage(); cursorY = margin;
        }
        doc.text(lines[i], margin, cursorY);
        cursorY += lineHeight;
      }
    };
    addBodyText(reportText || "");

    const safeTs = ts.replace(/[:]/g, "-").replace(/\s+/g, "_");
    doc.save(`SOMA_Report_${safeTs}_${model}.pdf`);
  }

  function handleViewJSON() {
    setShowJSON((v) => !v);
  }

  // 供 View JSON 使用的精简信息（不内联整张 base64 图，避免过大）
  const jsonMeta = {
    model,
    generated_at: ts,
    has_mask: !!(masks && masks.length > 0),
    mask_dims: masks && masks[0]?.maskDims ? masks[0].maskDims : null,
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
          {uploadedImage && masks && masks.length > 0 ? (
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

        {isEditing ? (
          <textarea
            ref={textAreaRef}
            value={reportText}
            onChange={(e) => onChangeText(e.target.value)}
            className="h-64 w-full resize-none rounded-lg border p-3 text-sm text-gray-800 focus:ring-2 focus:ring-blue-200 bg-white"
          />
        ) : (
          <div className="h-64 w-full overflow-y-auto rounded-lg border bg-gray-50 p-3">
            <div className="prose prose-sm prose-gray max-w-none [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:mt-4 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-2 [&>p]:mb-2 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-1 [&>strong]:font-semibold [&>hr]:my-3">
              <ReactMarkdown>{reportText || "No report content"}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
