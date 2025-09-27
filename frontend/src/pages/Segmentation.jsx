import React, { useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import main from "../assets/images/Main.png";
import Decoration from "../assets/images/main2.png";
import "./patient.css";
import axios from "axios";

// NEW: import the extracted panel (保持不变)
import ReportPanel from "../components/ReportPanel";

const SegmentationPage = () => {
  const [activeTab, setActiveTab] = useState("segmentation");
  const [fileName, setFileName] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reportText, setReportText] = useState(defaultReport);
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("SOMA-CT-v1");

  // === SecondPage 功能等价映射 ===
  const [mode, setMode] = useState("foreground"); // 'foreground' | 'background'
  const [tool, setTool] = useState("point");      // 'point' | 'box' | 'everything'
  const dropZoneRef = useRef(null);

  // 图像与尺寸
  const [uploadedImage, setUploadedImage] = useState(null);    // dataURL
  const imgElRef = useRef(null);                               // 离屏 Image 对象
  const [origImSize, setOrigImSize] = useState([0, 0]);        // [H, W]

  // Embeddings
  const [imageEmbeddings, setImageEmbeddings] = useState([]);  // number[]
  const [embeddingsDims, setEmbeddingsDims] = useState([]);    // number[]

  // 交互点
  const [clickPoints, setClickPoints] = useState([]);          // [{x,y}] (基于上传区显示尺寸)
  const [pointLabels, setPointLabels] = useState([]);          // 1 前景 / 0 后景
  const [lastRunIndex, setLastRunIndex] = useState(0);

  // 掩码与细化
  const [maskOutput, setMaskOutput] = useState(null);          // 0/1 数组(或Float32)
  const [maskDims, setMaskDims] = useState(null);              // [H,W]
  const [maskInput, setMaskInput] = useState(null);            // low_res_masks
  const [hasMaskInput, setHasMaskInput] = useState([0]);
  const [lowResStack, setLowResStack] = useState([]);          // 历史 logits

  // 右侧聊天
  const [messages, setMessages] = useState([]);                // {role:'user'|'assistant', text:string}
  const [isAnalysisTriggered, setIsAnalysisTriggered] = useState(false);

  const inputRef = useRef(null);

  // ---------------- 文件处理：读取→上传到 /api/load_model → 保存尺寸与 embeddings ----------------
  async function handleFile(f) {
    setFileName(f.name);
    setIsRunning(true);
    try {
      const dataURL = await fileToDataURL(f);
      setUploadedImage(dataURL);

      // 预载离屏 Image 拿原始 H/W
      const { natW, natH } = await loadImageOffscreen(dataURL);
      imgElRef.current = new Image();
      imgElRef.current.src = dataURL;
      setOrigImSize([natH, natW]);

      // 上传到后端
      const form = new FormData();
      form.append("image", f);
      const resp = await axios.post("http://localhost:3000/api/load_model", form);
      setImageEmbeddings(resp.data.image_embeddings || []);
      setEmbeddingsDims(resp.data.embedding_dims || []);

      // UI 提示
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1200);
    } catch (e) {
      console.error("load_model error:", e);
      alert("Failed to process the image. Please check server logs.");
    } finally {
      setIsRunning(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function handleBrowse() {
    inputRef.current?.click();
  }

  function handleContainerClick(e) {
    // 未上传：行为保持为“选文件”
    if (!uploadedImage || !fileName) {
      handleBrowse();
      return;
    }
    // 已上传：当 Tool=point 时，记录点击点
    if (tool !== "point") {
      alert("当前 Demo 仅实现 Point 提示；Box/Everything 暂未接入后端。");
      return;
    }
    if (!dropZoneRef.current) return;
    const rect = dropZoneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setClickPoints((prev) => [...prev, { x, y }]);
    setPointLabels((prev) => [...prev, mode === "foreground" ? 1 : 0]);
  }

  // ---------------- 运行模型：整合 refine / recompute 逻辑并调用 /api/run_model ----------------
  function isDisplayPointInsideMask(p, maskOut, dims) {
    if (!dropZoneRef.current || !maskOut || !dims) return false;
    const displayW = dropZoneRef.current.clientWidth;
    const displayH = dropZoneRef.current.clientHeight;
    const [H, W] = dims;
    const mx = Math.round(p.x * (W / displayW));
    const my = Math.round(p.y * (H / displayH));
    if (mx < 0 || my < 0 || mx >= W || my >= H) return false;
    const idx = my * W + mx;
    return Number(maskOut[idx]) > 0.5;
  }

  async function runModel() {
    if (!uploadedImage || !imageEmbeddings?.length) {
      alert("Please upload an image and wait for embeddings.");
      return;
    }
    if (tool !== "point") {
      alert("Only Point tool is implemented in backend for now.");
      return;
    }
    if (clickPoints.length === 0) {
      alert("Please add at least one point by clicking the upload area.");
      return;
    }
    // 尺寸与坐标变换（显示→原图）
    const [H, W] = origImSize;
    const displayW = dropZoneRef.current?.clientWidth || 1;
    const displayH = dropZoneRef.current?.clientHeight || 1;
    const toOrig = (p) => ([
      Math.max(0, Math.min(Math.round(p.x * (W / displayW)), W)),
      Math.max(0, Math.min(Math.round(p.y * (H / displayH)), H)),
    ]);

    // 新增点
    const newPts = clickPoints.slice(lastRunIndex);
    const newLabs = pointLabels.slice(lastRunIndex);

    // 1) 默认细化
    let useRefine = !!maskInput && hasMaskInput?.[0] === 1;

    // 2) 若新增“正点”有落在当前掩码外 → 改为重算
    if (newPts.length > 0 && maskOutput && maskDims) {
      const posOutside = newPts.some((p, i) => newLabs[i] === 1 && !isDisplayPointInsideMask(p, maskOutput, maskDims));
      if (posOutside) useRefine = false;
    }

    // 3) 组装点
    let sendPointCoords = [];
    let sendPointLabels = [];
    if (useRefine) {
      sendPointCoords = newPts.map(toOrig);
      sendPointLabels = [...newLabs];
    } else {
      sendPointCoords = clickPoints.map(toOrig);
      sendPointLabels = [...pointLabels];
    }

    // 调用后端
    setIsRunning(true);
    try {
      const body = {
        image_embeddings: imageEmbeddings,
        embedding_dims: embeddingsDims,
        point_coords: sendPointCoords,
        point_labels: sendPointLabels,
        mask_input: useRefine ? maskInput : null,
        has_mask_input: useRefine ? [1] : [0],
        orig_im_size: [H, W],
        hint_type: "point",
      };
      const res = await axios.post("http://localhost:3000/api/run_model", body);
      const data = res.data || {};

      const visMask = data.masks;
      const visShape = data.masks_shape;
      const visHW = Array.isArray(visShape) ? visShape.slice(-2) : null;

      setMaskOutput(visMask || null);
      setMaskDims(visHW);

      if (Array.isArray(data.low_res_masks)) {
        setMaskInput(data.low_res_masks);
        setHasMaskInput([1]);
        setLowResStack((stk) => [...stk, data.low_res_masks]);
      } else {
        setMaskInput(null);
        setHasMaskInput([0]);
      }

      setLastRunIndex(clickPoints.length);
    } catch (e) {
      console.error("run_model error:", e);
      alert("Model inference failed.");
    } finally {
      setIsRunning(false);
    }
  }

  // ---------------- Undo / Reset ----------------
  function undoPoints() {
    // 1) 回退点与标签
    setClickPoints((prev) => prev.slice(0, -1));
    setPointLabels((prev) => prev.slice(0, -1));
    // 2) 回退 refine 历史
    setLowResStack((prev) => {
      if (prev.length === 0) {
        setMaskInput(null);
        setHasMaskInput([0]);
        return prev;
      }
      const next = prev.slice(0, -1);
      if (next.length === 0) {
        setMaskInput(null);
        setHasMaskInput([0]);
      } else {
        setMaskInput(next[next.length - 1]);
        setHasMaskInput([1]);
      }
      return next;
    });
  }

  function resetImage() {
    setFileName(null);
    setUploadedImage(null);
    setImageEmbeddings([]);
    setEmbeddingsDims([]);
    setOrigImSize([0, 0]);

    setClickPoints([]);
    setPointLabels([]);
    setLastRunIndex(0);

    setMaskOutput(null);
    setMaskDims(null);
    setMaskInput(null);
    setHasMaskInput([0]);
    setLowResStack([]);
  }

  // ---------------- Compose 覆盖图并触发 /api/medical_report_init ----------------
  async function handleAnalysis() {
    if (!imgElRef.current || !maskOutput || !maskDims) {
      alert("No segmentation mask found. Please run the model first.");
      return;
    }
    setIsRunning(true);
    try {
      const blob = await composeOverlayPNG({
        imageEl: imgElRef.current,
        mask: Array.isArray(maskOutput) ? maskOutput : Array.from(maskOutput),
        maskDims: maskDims,
        overlayColor: "#1E90FF",
        overlayOpacity: 0.6,
        scale_factor: 0.6,
        export_quality: 0.8,
      });
      const image_base64 = await blobToDataURL(blob);

      const res = await axios.post("http://localhost:3000/api/medical_report_init", {
        final_image: image_base64,
      });
      const report = res.data?.report || sampleGeneratedReport;
      setReportText(report);
      setActiveTab("report");
      setIsAnalysisTriggered(true);
    } catch (e) {
      console.error("medical_report_init error:", e);
      alert("Report generation failed.");
    } finally {
      setIsRunning(false);
    }
  }

  // ---------------- 右侧聊天：/api/medical_report_rein ----------------
  async function sendMessage() {
    if (!isAnalysisTriggered) {
      alert("Please run Analyse first to initialize the report context.");
      return;
    }
    const content = question.trim();
    if (!content) return;

    setMessages((prev) => [...prev, { role: "user", text: content }]);
    setQuestion("");
    setIsRunning(true);
    try {
      // 加一个占位loading
      setMessages((prev) => [...prev, { role: "assistant", text: "loading" }]);
      const res = await axios.post("http://localhost:3000/api/medical_report_rein", {
        userMessage: content,
      });
      const reply = res.data?.reply || "Service is temporarily unavailable.";
      setMessages((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex((m) => m.role === "assistant" && m.text === "loading");
        if (idx !== -1) arr[idx] = { role: "assistant", text: reply };
        return arr;
      });
    } catch (e) {
      setMessages((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex((m) => m.role === "assistant" && m.text === "loading");
        if (idx !== -1) arr[idx] = { role: "assistant", text: "Service is temporarily unavailable." };
        return arr;
      });
    } finally {
      setIsRunning(false);
    }
  }

  // ---------------- 小工具函数 ----------------
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => resolve(rd.result);
      rd.onerror = reject;
      rd.readAsDataURL(file);
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve) => {
      const rd = new FileReader();
      rd.onloadend = () => resolve(rd.result);
      rd.readAsDataURL(blob);
    });
  }

  function loadImageOffscreen(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve({ natW: im.naturalWidth, natH: im.naturalHeight });
      im.onerror = reject;
      im.src = src;
    });
  }

  async function composeOverlayPNG({
    imageEl,
    mask,
    maskDims,
    overlayColor = "#FF4D4F",
    overlayOpacity = 0.35,
    scale_factor = 0.8,
    export_quality = 0.8,
  }) {
    if (!imageEl || !mask || !maskDims) throw new Error("composeOverlayPNG: missing args");
    const natW = imageEl.naturalWidth;
    const natH = imageEl.naturalHeight;
    const [mH, mW] = maskDims;
    if (mask.length !== mH * mW) throw new Error("mask length mismatch with maskDims");

    const hex = overlayColor.replace("#", "");
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    const a = Math.round(Math.max(0, Math.min(1, overlayOpacity)) * 255);

    // 1) 原图画布
    const out = document.createElement("canvas");
    out.width = natW; out.height = natH;
    const octx = out.getContext("2d");
    octx.drawImage(imageEl, 0, 0, natW, natH);

    // 2) 遮罩画布
    const mc = document.createElement("canvas");
    mc.width = mW; mc.height = mH;
    const mctx = mc.getContext("2d");
    const imgData = mctx.createImageData(mW, mH);
    for (let i = 0; i < mask.length; i++) {
      const on = Number(mask[i]) > 0.5;
      const off = i * 4;
      imgData.data[off] = r;
      imgData.data[off + 1] = g;
      imgData.data[off + 2] = b;
      imgData.data[off + 3] = on ? a : 0;
    }
    mctx.putImageData(imgData, 0, 0);

    // 3) 放大到原图叠加
    octx.imageSmoothingEnabled = false;
    octx.drawImage(mc, 0, 0, natW, natH);

    // 4) 导出前缩放
    let exportCanvas = out;
    if (scale_factor > 0 && scale_factor < 1) {
      const tw = Math.max(1, Math.round(natW * scale_factor));
      const th = Math.max(1, Math.round(natH * scale_factor));
      const small = document.createElement("canvas");
      small.width = tw; small.height = th;
      const sctx = small.getContext("2d");
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(out, 0, 0, tw, th);
      exportCanvas = small;
    }

    const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/webp", export_quality))
      || await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/jpeg", export_quality))
      || await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png"));
    return blob;
  }

  // ---------------- 下拉选项（保持不变） ----------------
  const segOptions = useMemo(
    () => [
      { id: "foreground", label: "Foreground segmentation" },
      { id: "background", label: "Background segmentation" },
    ],
    []
  );

  const toolOptions = useMemo(
    () => [
      { id: "point", label: "Point" },
      { id: "box", label: "Box" },
      { id: "everything", label: "Everything" },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-100 border border-green-300 text-green-800 px-5 py-2 rounded-lg shadow z-50">
          Image processed successfully
        </div>
      )}

      <div className="relative w-full max-w-6xl">
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        <div className="bg-white rounded-3xl shadow-2xl px-6 md:px-12 py-8 md:py-14 relative min-h-[90vh] pb-24">
          {isRunning && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30 rounded-3xl">
              <div className="mr-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              <span className="text-blue-700 font-medium">Working…</span>
            </div>
          )}

          <Header activeTab="segmentation" showLogout />

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

          <div className="mt-10 flex flex-col md:flex-row gap-6">
            {/* Left: Segmentation */}
            <div className="md:basis-3/5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              {/* Tabs */}
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
                  <div
                    ref={dropZoneRef}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={handleContainerClick}
                    className="group relative flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-gray-300 bg-white hover:bg-gray-50"
                    title={
                      uploadedImage
                        ? "Click to add a point (Point tool). Use radio to switch Foreground/Background."
                        : "Click to choose a file or drag an image here"
                    }
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

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
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

                    <div className="col-span-2 md:col-span-1 flex items-center">
                      <button
                        onClick={runModel}
                        className="w-full h-11 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                        disabled={!fileName || clickPoints.length === 0}
                        title="Run model"
                      >
                        Run Model
                      </button>
                    </div>
                    <div className="col-span-2 md:col-span-1 flex gap-2 min-w-0">
                      <button
                        onClick={undoPoints}
                        className="flex-1 min-w-[130px] h-11 rounded-full border px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                        disabled={clickPoints.length === 0}
                      >
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
                  samples={{ medical: sampleGeneratedReport, formal: defaultReport }}
                />
              )}
            </div>

            {/* Right: Chat */}
            <div className="md:basis-2/5 rounded-2xl border bg-white p-4 shadow-sm flex flex-col h-[560px]">
              <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-3">
                {/* 动态消息渲染（保持容器结构不变） */}
                {messages.length === 0 ? (
                  <>
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
                  </>
                ) : (
                  messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="mb-2 flex justify-end">
                        <div className="max-w-[75%] rounded-full bg-blue-100 px-4 py-2 text-sm text-gray-800">
                          {m.text}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="mb-2 flex justify-start">
                        <div className="max-w-[75%] w-full rounded-2xl bg-white px-4 py-2 text-sm text-gray-900 border text-left">
                          {m.text === "loading" ? "…" : m.text}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Add"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Settings"
                    >
                      ⚙
                    </button>
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

                <button
                  onClick={handleAnalysis}
                  className="ml-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  title="Generate report from current mask"
                  disabled={!maskOutput || !maskDims}
                >
                  Analyse
                </button>
              </div>

              <div className="mt-3 flex items-start gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your questions…"
                  className="flex-1 h-28 resize-none rounded-xl border bg-blue-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  onClick={sendMessage}
                  className="h-10 shrink-0 rounded-md border px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  title="Send"
                  disabled={!isAnalysisTriggered}
                >
                  Send
                </button>
              </div>
            </div>
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
