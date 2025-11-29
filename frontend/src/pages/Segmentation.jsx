import React, { useMemo, useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Header from "../components/Header";
import main from "../assets/images/Main.png";
import Decoration from "../assets/images/main2.png";
import "./patient.css";
import axios from "axios";
import ReportPanel from "../components/ReportPanel";
import SegmentationActionsBar from "../components/SegmentationActionsBar";
import { Eye, EyeOff, Trash2, ChevronDown } from "lucide-react";
import { streamRequest, streamChat, ANALYSIS_PHASES } from "../lib/api";

const SegmentationPage = () => {
  const [activeTab, setActiveTab] = useState("segmentation");
  const [fileName, setFileName] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reportText, setReportText] = useState(defaultReport);
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("SOMA-CT-v1");

  // === 同原实现 ===
  const [mode, setMode] = useState("foreground");
  const [tool, setTool] = useState("point");
  const dropZoneRef = useRef(null);

  // 图像与尺寸
  const [uploadedImage, setUploadedImage] = useState(null);
  const imgElRef = useRef(null);
  const [origImSize, setOrigImSize] = useState([0, 0]);

  // Embeddings
  const [imageEmbeddings, setImageEmbeddings] = useState([]);
  const [embeddingsDims, setEmbeddingsDims] = useState([]);

  // 点提示
  const [clickPoints, setClickPoints] = useState([]);
  const [pointLabels, setPointLabels] = useState([]);
  const [lastRunIndex, setLastRunIndex] = useState(0);

  // 多掩码
  // { mask, maskDims, maskInput, hasMaskInput, lowResStack, visible, name, color }
  const [masks, setMasks] = useState([]);
  const [currentMaskIndex, setCurrentMaskIndex] = useState(0);

  // Chat
  const [messages, setMessages] = useState([]);
  const [isAnalysisTriggered, setIsAnalysisTriggered] = useState(false);

  // SSE Progress tracking
  const [analysisProgress, setAnalysisProgress] = useState(null); // { step, label, progress }
  const [agentLogs, setAgentLogs] = useState([]); // [{agent, message, level, timestamp}]
  const [showCompletion, setShowCompletion] = useState(false); // Completion animation state
  const [sessionId, setSessionId] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('medicalReportSessionId') || null;
  });

  const inputRef = useRef(null);

  // 叠加画布
  const canvasRef = useRef(null);
  const [redrawTick, setRedrawTick] = useState(0);

  // ===== 新：Masks 折叠面板（默认关闭），最多显示 2 项 =====
  const [maskListOpen, setMaskListOpen] = useState(false);
  const listWrapRef = useRef(null);
  const listULRef = useRef(null);
  const [listMaxHeight, setListMaxHeight] = useState(0); // 计算后的动画高度

  // 色板
  const maskColors = ["#1E90FF","#00BFFF","#7FFF00","#FFD700","#FF7F50","#FF1493","#8A2BE2"];

  // 窗口变化重绘
  useEffect(() => {
    const onResize = () => setRedrawTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // tab 切换回 segmentation 时刷新一次
  useEffect(() => {
    if (activeTab === "segmentation") setRedrawTick((t) => t + 1);
  }, [activeTab]);

  // Persist sessionId to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('medicalReportSessionId', sessionId);
    }
  }, [sessionId]);

  // ======= 文件处理 =======
  async function handleFile(f) {
    setFileName(f.name);
    setIsRunning(true);
    try {
      const dataURL = await fileToDataURL(f);
      setUploadedImage(dataURL);

      const { natW, natH } = await loadImageOffscreen(dataURL);
      setOrigImSize([natH, natW]);

      const im = new Image();
      im.src = dataURL;
      imgElRef.current = im;

      const form = new FormData();
      form.append("image", f);
      const resp = await axios.post("http://localhost:3000/api/load_model", form);
      setImageEmbeddings(resp.data.image_embeddings || []);
      setEmbeddingsDims(resp.data.embedding_dims || []);

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

  // 画面内点击 -> 记录点
  function handleContainerClick(e) {
    if (!uploadedImage || !fileName) {
      handleBrowse();
      return;
    }
    if (tool !== "point") {
      alert("当前仅支持 Point 工具。");
      return;
    }
    if (!dropZoneRef.current) return;

    const hostRect = dropZoneRef.current.getBoundingClientRect();
    const imgRect = getImageRect();
    if (!imgRect) return;

    const localX = e.clientX - hostRect.left - imgRect.offsetX;
    const localY = e.clientY - hostRect.top - imgRect.offsetY;
    if (localX < 0 || localY < 0 || localX > imgRect.drawW || localY > imgRect.drawH) return;

    const x = localX / imgRect.drawW;
    const y = localY / imgRect.drawH;

    setClickPoints((prev) => [...prev, { x, y }]);
    setPointLabels((prev) => [...prev, mode === "foreground" ? 1 : 0]);
  }

  // 运行模型（仅新增点）
  async function runModel() {
    if (!uploadedImage || !imageEmbeddings?.length) {
      alert("请先上传图片并等待后端返回 embeddings");
      return;
    }
    if (tool !== "point") {
      alert("当前 Demo 仅实现点提示");
      return;
    }
    const newPts = clickPoints.slice(lastRunIndex);
    const newLabs = pointLabels.slice(lastRunIndex);
    if (newPts.length === 0) {
      alert("请先添加新的点再运行模型");
      return;
    }

    // 原图尺寸确保
    let [H, W] = origImSize;
    if (!(Number.isFinite(H) && H > 0 && Number.isFinite(W) && W > 0)) {
      const dims = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve([im.naturalHeight, im.naturalWidth]);
        im.onerror = reject;
        im.src = uploadedImage;
      });
      [H, W] = dims;
      setOrigImSize(dims);
      if (!imgElRef.current) {
        const im2 = new Image();
        im2.src = uploadedImage;
        imgElRef.current = im2;
      }
    }

    const toPlainArray = (v) => (v == null ? v : ArrayBuffer.isView(v) ? Array.from(v) : Array.isArray(v) ? v : v);
    const toPointPairs = (arr) => (Array.isArray(arr) ? arr.map((p) => [Math.round(p.x * W), Math.round(p.y * H)]) : []);

    // 外扩判断
    const curMaskObj = masks[currentMaskIndex] || {};
    const curMaskArr = Array.isArray(curMaskObj.mask) ? curMaskObj.mask : Array.from(curMaskObj.mask || []);
    const curMaskDims = curMaskObj.maskDims || null;
    const existsPosOutside = (() => {
      if (!(newPts.length > 0 && curMaskArr && curMaskDims)) return false;
      const [mH, mW] = curMaskDims;
      if (!mH || !mW) return false;
      return newPts.some((p, i) => {
        if (newLabs[i] !== 1) return false;
        const mx = Math.max(0, Math.min(Math.round(p.x * mW), mW - 1));
        const my = Math.max(0, Math.min(Math.round(p.y * mH), mH - 1));
        const idx = my * mW + mx;
        return !(Number(curMaskArr[idx]) > 0.5);
      });
    })();

    const curMaskInput = curMaskObj.maskInput || null;
    const curHasMaskInput = curMaskObj.hasMaskInput || [0];
    const wantRefine = !!curMaskInput && curHasMaskInput?.[0] === 1 && !existsPosOutside;

    const sendPointCoords = toPointPairs(newPts);
    const sendPointLabels = [...newLabs];

    const validLowResMask = (arr) => {
      if (!Array.isArray(arr)) return false;
      const L = arr.length;
      const s = Math.sqrt(L);
      return Number.isInteger(s) && s > 0;
    };
    const refinedMask = wantRefine && validLowResMask(curMaskInput) ? curMaskInput : null;
    const refinedFlag = refinedMask ? [1] : [0];

    setIsRunning(true);
    try {
      const body = {
        image_embeddings: toPlainArray(imageEmbeddings),
        embedding_dims: toPlainArray(embeddingsDims),
        point_coords: toPlainArray(sendPointCoords),
        point_labels: toPlainArray(sendPointLabels),
        mask_input: refinedMask ? toPlainArray(refinedMask) : null,
        has_mask_input: refinedFlag,
        orig_im_size: [H, W],
        hint_type: "point",
      };

      const res = await axios.post("http://localhost:3000/api/run_model", body);
      const data = res.data || {};

      const visMask = ArrayBuffer.isView(data.masks) ? Array.from(data.masks) : data.masks;
      const visShape = data.masks_shape;
      const visHW = Array.isArray(visShape) ? visShape.slice(-2) : null;

      setMasks((prev) => {
        const next = [...prev];
        const maskObj = {
          mask: visMask || null,
          maskDims: visHW,
          maskInput: Array.isArray(data.low_res_masks) ? data.low_res_masks : null,
          hasMaskInput: Array.isArray(data.low_res_masks) ? [1] : [0],
          lowResStack: Array.isArray(data.low_res_masks) ? [data.low_res_masks] : [],
          visible: true,
          name: `Mask ${currentMaskIndex + 1}`,
          color: maskColors[currentMaskIndex % maskColors.length],
        };
        if (next[currentMaskIndex]) next[currentMaskIndex] = maskObj;
        else next[currentMaskIndex] = maskObj;
        return next;
      });

      setLastRunIndex(clickPoints.length);
      setRedrawTick((t) => t + 1);
    } catch (e) {
      console.error("调用模型失败:", e);
      alert("Model inference failed: " + (e.response?.data?.error || e.message));
    } finally {
      setIsRunning(false);
    }
  }

  // 新增一个空槽位
  function startNextMask() {
    setClickPoints([]);
    setPointLabels([]);
    setLastRunIndex(0);
    setMasks((prev) => {
      const next = [...prev];
      const idx = prev.length;
      next.push({
        mask: null, maskDims: null, maskInput: null, hasMaskInput: [0],
        lowResStack: [], visible: true, name: `Mask ${idx + 1}`,
        color: maskColors[idx % maskColors.length],
      });
      setCurrentMaskIndex(idx);
      return next;
    });
  }

  // 图片显示矩形
  function getImageRect() {
    if (!dropZoneRef.current) return null;
    const box = dropZoneRef.current;
    const contW = box.clientWidth;
    const contH = box.clientHeight;
    const [natH, natW] = origImSize;
    if (!natH || !natW || !contW || !contH) return null;

    const scale = Math.min(contW / natW, contH / natH);
    const drawW = Math.round(natW * scale);
    const drawH = Math.round(natH * scale);
    const offsetX = Math.round((contW - drawW) / 2);
    const offsetY = Math.round((contH - drawH) / 2);
    return { contW, contH, drawW, drawH, offsetX, offsetY };
  }

  function pointDotClass(index) {
    return pointLabels[index] === 1 ? "bg-blue-500" : "bg-red-500";
  }
  function styleForPoint(p) {
    const r = getImageRect();
    if (!r) return { display: "none" };
    const left = r.offsetX + p.x * r.drawW;
    const top  = r.offsetY + p.y * r.drawH;
    return { left: `${left}px`, top: `${top}px`, transform: "translate(-50%, -50%)" };
  }

  // 绘制叠加掩码
  useEffect(() => {
    if (!canvasRef.current || !dropZoneRef.current) return;
    const rect = getImageRect();
    if (!rect) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.contW * dpr);
    canvas.height = Math.round(rect.contH * dpr);
    canvas.style.width = `${rect.contW}px`;
    canvas.style.height = `${rect.contH}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.contW, rect.contH);

    if (!uploadedImage || !masks || masks.length === 0) return;

    masks.forEach((mObj, idx) => {
      if (!mObj || !mObj.visible || !mObj.mask || !mObj.maskDims) return;
      const maskArr = Array.isArray(mObj.mask) ? mObj.mask : Array.from(mObj.mask || []);
      const md = mObj.maskDims;
      if (!md || maskArr.length !== md[0] * md[1]) return;

      const [mH, mW] = md;
      const temp = document.createElement("canvas");
      temp.width = mW; temp.height = mH;
      const tctx = temp.getContext("2d");
      const imgData = tctx.createImageData(mW, mH);

      const hex = (mObj.color || maskColors[idx % maskColors.length]).replace("#", "");
      const rC = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
      const gC = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
      const bC = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
      const A = Math.round(0.6 * 255);

      for (let i = 0; i < maskArr.length; i++) {
        const on = Number(maskArr[i]) > 0.5;
        const off = i * 4;
        imgData.data[off] = rC;
        imgData.data[off + 1] = gC;
        imgData.data[off + 2] = bC;
        imgData.data[off + 3] = on ? A : 0;
      }
      tctx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(temp, rect.offsetX, rect.offsetY, rect.drawW, rect.drawH);
    });
  }, [masks, uploadedImage, origImSize, redrawTick, activeTab]);

  // 导出覆盖图
  async function handleExportOverlay() {
    try {
      if (!imgElRef.current || !uploadedImage || !masks || masks.length === 0) {
        alert("No mask to export. Please run the model first.");
        return;
      }
      const natW = imgElRef.current.naturalWidth;
      const natH = imgElRef.current.naturalHeight;
      const out = document.createElement("canvas");
      out.width = natW; out.height = natH;
      const octx = out.getContext("2d");
      octx.drawImage(imgElRef.current, 0, 0, natW, natH);

      masks.forEach((mObj, idx) => {
        if (!mObj || !mObj.visible || !mObj.mask || !mObj.maskDims) return;
        const [mH, mW] = mObj.maskDims;
        const tmp = document.createElement("canvas");
        tmp.width = mW; tmp.height = mH;
        const tctx = tmp.getContext("2d");
        const imgData = tctx.createImageData(mW, mH);
        const maskArr = Array.isArray(mObj.mask) ? mObj.mask : Array.from(mObj.mask || []);
        const hex = (mObj.color || maskColors[idx % maskColors.length]).replace("#", "");
        const rC = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
        const gC = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
        const bC = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
        const a = Math.round(0.6 * 255);
        for (let i = 0; i < maskArr.length; i++) {
          const on = Number(maskArr[i]) > 0.5;
          const off = i * 4;
          imgData.data[off] = rC; imgData.data[off + 1] = gC; imgData.data[off + 2] = bC; imgData.data[off + 3] = on ? a : 0;
        }
        tctx.putImageData(imgData, 0, 0);
        octx.imageSmoothingEnabled = false;
        octx.drawImage(tmp, 0, 0, natW, natH);
      });

      const outBlob =
        (await new Promise((resolve) => out.toBlob(resolve, "image/png", 1))) ||
        (await new Promise((resolve) => out.toBlob(resolve, "image/webp", 0.95)));
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(outBlob, `overlay_${ts}.png`);
    } catch (err) {
      console.error("导出失败：", err);
      alert("导出失败，请查看控制台日志");
    }
  }
  function downloadBlob(blob, filename = "overlay.png") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // 撤销 / 重置
  function undoPoints() {
    setClickPoints((prev) => prev.slice(0, -1));
    setPointLabels((prev) => prev.slice(0, -1));
    setMasks((prev) => {
      const next = [...prev];
      const cur = next[currentMaskIndex];
      if (!cur) return prev;
      const stack = cur.lowResStack || [];
      if (stack.length === 0) return prev;
      const newStack = stack.slice(0, -1);
      cur.lowResStack = newStack;
      cur.maskInput = newStack.length ? newStack[newStack.length - 1] : null;
      cur.hasMaskInput = newStack.length ? [1] : [0];
      next[currentMaskIndex] = { ...cur };
      return next;
    });
    setRedrawTick((t) => t + 1);
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

    setMasks([]);
    setCurrentMaskIndex(0);
    setRedrawTick((t) => t + 1);
  }

  // 生成报告 (支持 SSE 流式进度)
  async function handleAnalysis(useStreaming = true) {
    if (!imageEmbeddings.length) {
      alert("Please upload an image and wait for embeddings before analyzing.");
      return;
    }
    if (!imgElRef.current || !masks || masks.length === 0) {
      alert("No segmentation mask found. Please run the model first.");
      return;
    }
    setIsRunning(true);
    setAgentLogs([]); // Clear previous logs
    setAnalysisProgress({ step: 'preparing', label: 'Preparing image...', progress: 5, agent: null });

    try {
      // 准备叠加图像
      const natW = imgElRef.current.naturalWidth;
      const natH = imgElRef.current.naturalHeight;
      const out = document.createElement("canvas");
      out.width = natW; out.height = natH;
      const octx = out.getContext("2d");
      octx.drawImage(imgElRef.current, 0, 0, natW, natH);
      masks.forEach((mObj, idx) => {
        if (!mObj || !mObj.visible || !mObj.mask || !mObj.maskDims) return;
        const [mH, mW] = mObj.maskDims;
        const tmp = document.createElement("canvas");
        tmp.width = mW; tmp.height = mH;
        const tctx = tmp.getContext("2d");
        const imgData = tctx.createImageData(mW, mH);
        const maskArr = Array.isArray(mObj.mask) ? mObj.mask : Array.from(mObj.mask || []);
        const hex = (mObj.color || maskColors[idx % maskColors.length]).replace("#", "");
        const rC = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
        const gC = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
        const bC = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
        const a = Math.round(0.6 * 255);
        for (let i = 0; i < maskArr.length; i++) {
          const on = Number(maskArr[i]) > 0.5;
          const off = i * 4;
          imgData.data[off] = rC; imgData.data[off + 1] = gC; imgData.data[off + 2] = bC; imgData.data[off + 3] = on ? a : 0;
        }
        tctx.putImageData(imgData, 0, 0);
        octx.imageSmoothingEnabled = false;
        octx.drawImage(tmp, 0, 0, natW, natH);
      });
      const blob = (await new Promise((resolve) => out.toBlob(resolve, "image/webp", 0.8))) ||
                   (await new Promise((resolve) => out.toBlob(resolve, "image/png")));
      const image_base64 = await blobToDataURL(blob);

      if (useStreaming) {
        // SSE 流式请求
        await streamRequest('/medical_report_stream', { final_image: image_base64 }, {
          onProgress: (data) => {
            console.log('[SSE Progress] raw data:', JSON.stringify(data));
            // Try to get step from multiple possible locations
            const stepKey = data.step || data.phase || data.type;
            console.log('[SSE Progress] stepKey:', stepKey, 'ANALYSIS_PHASES keys:', Object.keys(ANALYSIS_PHASES));

            const phaseInfo = ANALYSIS_PHASES[stepKey] || {
              label: data.message || 'Processing...',
              progress: Math.min(90, (analysisProgress?.progress || 5) + 5), // Increment progress
              detail: data.detail || '',
              agent: data.agent || null
            };
            console.log('[SSE Progress] phaseInfo:', phaseInfo);

            setAnalysisProgress({
              step: stepKey,
              label: phaseInfo.label,
              detail: phaseInfo.detail,
              progress: phaseInfo.progress,
              agent: phaseInfo.agent,
            });
            if (data.sessionId) {
              setSessionId(data.sessionId);
            }
          },
          onLog: (data) => {
            console.log('[SSE Log]', data);
            setAgentLogs(prev => [...prev, {
              agent: data.agent,
              message: data.message,
              level: data.level,
              timestamp: Date.now()
            }]);
          },
          onComplete: (data) => {
            console.log('[SSE Complete]', data);
            const reportContent = typeof data.report === 'object' ? data.report?.content : data.report;
            setReportText(reportContent || sampleGeneratedReport);

            // Show completion animation
            setAnalysisProgress({ step: 'complete', label: 'Report Generated', progress: 100, agent: null });
            setShowCompletion(true);

            // Hide completion animation after 2 seconds and switch to report tab
            setTimeout(() => {
              setShowCompletion(false);
              setAnalysisProgress(null);
              setIsRunning(false);
              setActiveTab("report");
              setIsAnalysisTriggered(true);
            }, 2000);
          },
          onError: (err) => {
            console.error('[SSE Error]', err);
            setAnalysisProgress(null);
            setIsRunning(false);
            alert("Report generation failed: " + err.message);
          }
        });
      } else {
        // Fallback: 普通 POST 请求
        const res = await axios.post("http://localhost:3000/api/medical_report_init", { final_image: image_base64 });
        const reportContent = typeof res.data?.report === 'object' ? res.data.report?.content : res.data?.report;
        setReportText(reportContent || sampleGeneratedReport);
        setActiveTab("report");
        setIsAnalysisTriggered(true);
        setAnalysisProgress(null);
        setIsRunning(false);
      }
    } catch (e) {
      console.error("medical_report_init error:", e);
      setAnalysisProgress(null);
      setIsRunning(false);
      alert("Report generation failed.");
    }
  }

  // Chat Reinforce - Streaming implementation
  async function sendMessage() {
    if (!imageEmbeddings.length) {
      alert("Please upload an image and wait for embeddings before sending a message.");
      return;
    }
    if (!isAnalysisTriggered) {
      alert("Please run Analyse first to initialize the report context.");
      return;
    }
    const content = question.trim();
    if (!content) return;

    setMessages((prev) => [...prev, { role: "user", text: content }]);
    setQuestion("");
    setIsRunning(true);

    // Add streaming placeholder message
    const streamMsgId = Date.now();
    setMessages((prev) => [...prev, { role: "assistant", text: "", id: streamMsgId, isStreaming: true }]);

    try {
      await streamChat(
        { message: content, sessionId: sessionId || undefined },
        {
          onIntent: (data) => {
            console.log("[Chat] Intent:", data.intent, data.confidence);
          },
          onChunk: (chunk, fullText) => {
            // Update streaming message with accumulated text
            setMessages((prev) => {
              const arr = [...prev];
              const idx = arr.findIndex((m) => m.id === streamMsgId);
              if (idx !== -1) arr[idx] = { ...arr[idx], text: fullText };
              return arr;
            });
          },
          onRevision: (data) => {
            // Report was revised
            if (data.updatedReport) {
              const reportContent = typeof data.updatedReport === 'object'
                ? data.updatedReport?.content
                : data.updatedReport;
              if (reportContent) setReportText(reportContent);
            }
            // Show response message
            if (data.response) {
              setMessages((prev) => {
                const arr = [...prev];
                const idx = arr.findIndex((m) => m.id === streamMsgId);
                if (idx !== -1) arr[idx] = { ...arr[idx], text: data.response, isStreaming: false };
                return arr;
              });
            }
          },
          onError: (err) => {
            console.error("[Chat] Error:", err);
            setMessages((prev) => {
              const arr = [...prev];
              const idx = arr.findIndex((m) => m.id === streamMsgId);
              if (idx !== -1) arr[idx] = { ...arr[idx], text: "Service is temporarily unavailable.", isStreaming: false };
              return arr;
            });
          },
          onDone: () => {
            // Mark streaming as complete
            setMessages((prev) => {
              const arr = [...prev];
              const idx = arr.findIndex((m) => m.id === streamMsgId);
              if (idx !== -1) arr[idx] = { ...arr[idx], isStreaming: false };
              return arr;
            });
            setIsRunning(false);
          }
        }
      );
    } catch {
      setMessages((prev) => {
        const arr = [...prev];
        const idx = arr.findIndex((m) => m.id === streamMsgId);
        if (idx !== -1) arr[idx] = { ...arr[idx], text: "Service is temporarily unavailable.", isStreaming: false };
        return arr;
      });
    } finally {
      setIsRunning(false);
    }
  }

  // 工具函数
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
    imageEl, mask, maskDims, overlayColor = "#FF4D4F", overlayOpacity = 0.35,
    scale_factor = 0.8, export_quality = 0.8,
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

    const out = document.createElement("canvas");
    out.width = natW; out.height = natH;
    const octx = out.getContext("2d");
    octx.drawImage(imageEl, 0, 0, natW, natH);

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

    octx.imageSmoothingEnabled = false;
    octx.drawImage(mc, 0, 0, natW, natH);

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

    const blob =
      (await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/webp", export_quality))) ||
      (await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/jpeg", export_quality))) ||
      (await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png")));
    return blob;
  }

  // 下拉选项
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

  // ====== 计算列表展开时的最大高度（最多显示 2 条）======
  useEffect(() => {
    // compute a reasonable max height for the panel (show up to 6 items before scroll)
    if (!listULRef.current) {
      setListMaxHeight(0);
      return;
    }
    const items = Array.from(listULRef.current.querySelectorAll("li"));
    const itemCount = Math.max(0, items.length);
    // show up to 2 items in the visible window; rest available via scroll
    const sampleCount = Math.min(2, itemCount || 2);
    const h = items.slice(0, sampleCount).reduce((sum, el) => sum + el.offsetHeight, 0);
    const gap = 8; // UL padding/gap 微调
    const computed = Math.max(56, h + gap);
    const capped = Math.min(160, computed); // cap so the visible area equals ~2 items
    setListMaxHeight(capped);
  }, [masks, maskListOpen, activeTab]);

  // pointer drag to scroll support for the mask list
  useEffect(() => {
    const el = listULRef.current;
    if (!el) return;
    let isDown = false;
    let startY = 0;
    let startScroll = 0;

    function onPointerDown(e) {
      // don't start drag-to-scroll when clicking interactive controls inside the list
      const tgt = e.target;
      if (tgt) {
        // if clicking a button, svg icon, input or link, let the event go through
        if (tgt.closest && (tgt.closest('button') || tgt.closest('a') || tgt.closest('input') || tgt.closest('svg'))) {
          return;
        }
      }
      isDown = true;
      startY = e.clientY;
      startScroll = el.scrollTop;
      el.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e) {
      if (!isDown) return;
      const dy = e.clientY - startY;
      el.scrollTop = startScroll - dy;
    }
    function onPointerUp(e) {
      isDown = false;
      try { el.releasePointerCapture?.(e.pointerId); } catch (err) {}
    }
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [listULRef.current]);

  // 过滤出可渲染项（保持索引）
  const renderMasks = masks.map((m, idx) => ({ ...m, __idx: idx, __name: m?.name || `Mask ${idx + 1}` }));

  return (
    // <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">
    // <div className="min-h-screen bg-[#C2DCE7] py-6 md:py-10">
    <div className="min-h-screen bg-[#C2DCE7] py-8">

      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-100 border border-green-300 text-green-800 px-5 py-2 rounded-lg shadow-lg z-50 animate-[fadeIn_200ms_ease-out]">
          Image processed successfully
        </div>
      )}

      {/* Decorative blobs */}
      <div className="relative w-full max-w-6xl">
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        {/* Fixed-width wrapper */}
        <div className="mx-auto w-[1200px]"> {/* <- fixed width, not max-w */}

          {/* White sheet */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 relative w-full overflow-hidden min-h-[75vh] md:min-h-[80vh] pb-20">

            {/* Header */}
            <Header 
              activeTab="segmentation"
              showLogout={true}
              // showAddPatient={true}
              onAddPatientClick={() => document.getElementById("add_patient_modal").showModal()}
            />
            
            {((isRunning && analysisProgress) || showCompletion) && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30 rounded-3xl">
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full mx-4">
                  {showCompletion ? (
                    /* Completion Animation */
                    <div className="flex flex-col items-center justify-center py-4 animate-[fadeIn_300ms_ease-out]">
                      {/* Animated Blue Checkmark */}
                      <div className="relative mb-4">
                        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                          <svg
                            className="h-10 w-10 text-blue-600 animate-[checkDraw_500ms_ease-out_200ms_forwards]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                              style={{
                                strokeDasharray: 30,
                                strokeDashoffset: 0,
                              }}
                            />
                          </svg>
                        </div>
                        {/* Pulse ring effect */}
                        <div className="absolute inset-0 h-16 w-16 rounded-full bg-blue-400 animate-ping opacity-20" />
                      </div>
                      <h3 className="text-xl font-bold text-blue-700 mb-1">Report Generated</h3>
                      <p className="text-gray-500 text-sm">Completed successfully</p>
                    </div>
                  ) : (
                    /* Progress Animation - Clean & Minimal */
                    <div className="py-2">
                      {/* Spinner + Text row */}
                      <div className="flex items-center gap-4 mb-5">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 flex-shrink-0" />
                        <div className="text-left">
                          {analysisProgress?.agent && (
                            <p className="text-xs font-medium text-sky-500 mb-0.5 text-left">
                              {analysisProgress.agent}
                            </p>
                          )}
                          <p className="text-blue-700 font-semibold text-[18px] text-left">
                            {analysisProgress?.label || 'Working…'}
                          </p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {analysisProgress && (
                        <div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${analysisProgress.progress || 0}%` }}
                            />
                          </div>
                          <p className="text-right text-[10px] text-gray-400 mt-1.5">
                            {analysisProgress.progress || 0}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---------------- Hero Section (Title + Main Image) ---------------- */}
            <div className="relative flex items-center justify-between mt-10 md:mt-12 h-[150px]">
              {/* Title */}
              <div className="flex-1">
                <h1 className="text-5xl md:text-6xl font-extrabold text-[#3B82F6] leading-none">
                  SOMA <span className="text-black text-4xl md:text-5xl font-semibold">Health</span>
                </h1>
                <div className="mt-4 text-gray-500 text-lg">
                  <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle mr-3" />
                  <span className="align-middle">Description</span>
                  <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle ml-3" />
                </div>
              </div>

              {/* Main image */}
              <div className="flex-shrink-0 relative">
                <img
                  src={main}
                  alt="Login illustration"
                  className="w-[450px] object-contain pointer-events-none select-none"
                />
              </div>
            </div>


            {/* <div className="mt-10 flex flex-col md:flex-row gap-6"> */}
            <div className="mt-20 md:mt-28 relative z-10 flex flex-col md:flex-row gap-6">

              {/* Left */}
              {/* <div className="md:basis-3/5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"> */}
              <div className="md:basis-3/5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col">

                {/* Tabs */}
                <div className="mb-3 flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("segmentation")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm transition-all duration-200 ease-out active:scale-95 ${
                      activeTab === "segmentation" 
                        ? "bg-blue-600/90 text-white shadow-md" 
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400 hover:shadow"
                    }`}
                  >
                    Segmentation
                  </button>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm transition-all duration-200 ease-out active:scale-95 ${
                      activeTab === "report" 
                        ? "bg-blue-600/90 text-white shadow-md" 
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400 hover:shadow"
                    }`}
                  >
                    Report
                  </button>
                </div>

                {activeTab === "segmentation" ? (
                  <>
                    {/* 上传区 */}
                    <div
                      ref={dropZoneRef}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={handleContainerClick}
                      className="group relative flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200 ease-out"
                      title={uploadedImage ? "Click to add a point (Point tool)." : "Click to choose a file or drag an image here"}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(f);
                        }}
                      />
                      {uploadedImage ? (
                        <>
                          <img src={uploadedImage} alt="Uploaded Preview" className="absolute inset-0 h-full w-full object-contain rounded-2xl" />
                          <canvas ref={canvasRef} className="absolute inset-0 rounded-2xl pointer-events-none" />
                          {clickPoints.map((p, i) => (
                            <div key={i} className={`absolute w-2 h-2 rounded-full ${pointDotClass(i)}`} style={styleForPoint(p)} />
                          ))}
                        </>
                      ) : (
                        <>
                          <div className="mb-2 text-gray-600">Drag the image here to upload</div>
                          <button className="rounded-full bg-blue-600 px-4 py-1.5 text-white text-sm font-semibold shadow hover:bg-blue-700 hover:shadow-md transition-all duration-200 ease-out active:scale-95 group-hover:scale-105">
                            File
                          </button>
                        </>
                      )}
                      {fileName && <p className="mt-2 line-clamp-1 text-xs text-gray-500 animate-fade-in">{fileName}</p>}
                    </div>

                    {/* 选项 + 按钮 */}
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <fieldset className="col-span-2 flex flex-wrap items-center gap-3">
                        <legend className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Segmentation</legend>
                        {segOptions.map((opt) => (
                          <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors duration-150">
                            <input type="radio" name="mode" value={opt.id} checked={mode === opt.id} onChange={() => setMode(opt.id)} className="h-4 w-4 accent-blue-600 cursor-pointer transition-transform duration-150 hover:scale-110" />
                            <span className="select-none">{opt.label}</span>
                          </label>
                        ))}
                      </fieldset>

                      <fieldset className="col-span-2 flex flex-wrap items-center gap-3">
                        <legend className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Tool</legend>
                        {toolOptions.map((opt) => (
                          <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors duration-150">
                            <input type="radio" name="tool" value={opt.id} checked={tool === opt.id} onChange={() => setTool(opt.id)} className="h-4 w-4 accent-blue-600 cursor-pointer transition-transform duration-150 hover:scale-110" />
                            <span className="select-none">{opt.label}</span>
                          </label>
                        ))}
                      </fieldset>

                      {/* 行内按钮（重构为工具栏组件） */}
                      <div className="col-span-2 md:col-span-4">
                        <SegmentationActionsBar
                          onRunModel={runModel}
                          onUndoPoints={undoPoints}
                          onStartNextMask={startNextMask}
                          onResetImage={resetImage}
                          onExportOverlay={handleExportOverlay}
                          isRunning={isRunning}
                          disableRunModel={!fileName || clickPoints.length === 0}
                          disableUndoPoints={clickPoints.length === 0}
                          showExport={uploadedImage && masks && masks.length > 0}
                        />
                      </div>

                      {/* ======= 新：折叠式 Masks List（默认关闭；最多显示 2 项） ======= */}
                      <div className="col-span-2 md:col-span-4">
                        <div
                          ref={listWrapRef}
                          className="rounded-2xl border border-gray-300 bg-white overflow-hidden"
                          role="region"
                          aria-label="Masks list"
                        >
                          {/* Header */}
                          <button
                            type="button"
                            onClick={() => setMaskListOpen((o) => !o)}
                            aria-expanded={maskListOpen}
                            aria-controls="masks-panel"
                            className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none transition-colors duration-150 active:bg-gray-100"
                          >
                            <span className="transition-all duration-200">{maskListOpen ? '▼' : '▶'} Masks</span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-300 ease-out ${maskListOpen ? "rotate-180" : "rotate-0"}`}
                              aria-hidden="true"
                            />
                          </button>

                          {/* Content (animated) */}
                          <div
                            id="masks-panel"
                            style={{
                              maxHeight: maskListOpen ? `${listMaxHeight}px` : 0,
                            }}
                            className="transition-[max-height] duration-300 ease-in-out"
                          >
                            <ul ref={listULRef} className="divide-y overflow-y-auto" style={{ maxHeight: listMaxHeight, WebkitOverflowScrolling: 'touch' }}>
                              {renderMasks.length === 0 ? (
                                <li className="px-4 py-3 text-sm text-gray-500">No masks</li>
                              ) : (
                                renderMasks.map((mObj) => {
                                  const idx = mObj.__idx;
                                  const selected = currentMaskIndex === idx;
                                  return (
                                    <li key={idx} className={`flex items-center justify-between px-4 py-2 transition-all duration-200 ease-out ${selected ? "bg-blue-50 shadow-sm" : "hover:bg-gray-50"}`}>
                                      <button
                                        onClick={() => setCurrentMaskIndex(idx)}
                                        className="min-w-0 text-left flex items-center gap-2 hover:gap-3 transition-all duration-200 group"
                                        title={mObj.__name}
                                      >
                                        <span className="inline-block w-3 h-3 rounded-sm shrink-0 transition-transform duration-200 group-hover:scale-125" style={{ background: mObj?.color }} />
                                        <span className="truncate text-sm text-gray-800 group-hover:text-gray-900 transition-colors duration-150">{mObj.__name}</span>
                                      </button>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          aria-label={mObj?.visible ? "Hide" : "Show"}
                                          onClick={() => {
                                            setMasks((prev) => prev.map((m, j) => (j === idx ? { ...m, visible: !m.visible } : m)));
                                            setRedrawTick((t) => t + 1);
                                          }}
                                          className="rounded-md border px-2 py-1 hover:bg-white hover:shadow-sm transition-all duration-150 active:scale-90"
                                        >
                                          {mObj?.visible ? <Eye className="h-4 w-4 transition-transform duration-200 hover:scale-110" /> : <EyeOff className="h-4 w-4 transition-transform duration-200 hover:scale-110" />}
                                        </button>
                                        <button
                                          type="button"
                                          aria-label="Delete"
                                          onClick={() => {
                                            setMasks((prev) => {
                                              const next = prev.filter((_, j) => j !== idx);
                                              setCurrentMaskIndex((ci) => {
                                                if (next.length === 0) return 0;
                                                if (ci === idx) return Math.max(0, idx - 1);
                                                if (ci > idx) return ci - 1;
                                                return ci;
                                              });
                                              return next;
                                            });
                                            setRedrawTick((t) => t + 1);
                                          }}
                                          className="rounded-md border px-2 py-1 hover:bg-red-50 hover:border-red-300 hover:shadow-sm text-red-600 transition-all duration-150 active:scale-90"
                                        >
                                          <Trash2 className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                      {/* ======= /Masks List ======= */}
                    </div>
                  </>
                ) : (
                  <ReportPanel
                    reportText={reportText}
                    onChangeText={setReportText}
                    model={model}
                    onChangeModel={setModel}
                    samples={{ medical: sampleGeneratedReport, formal: defaultReport }}
                    uploadedImage={uploadedImage}
                    masks={masks}
                    origImSize={origImSize}
                  />
                )}
              </div>

              {/* Right: Chat */}
                <div className="md:basis-2/5 rounded-2xl border bg-white p-4 shadow-sm flex flex-col min-h-[500px]">

                {/* Messages area - grows to fill space, scrolls when needed */}
                <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-3 mb-3">
                  {messages.length === 0 ? (
                    <>
                      <div className="mb-2 flex justify-end animate-[fadeIn_300ms_ease-out]">
                        <div className="max-w-[75%] rounded-full bg-blue-100 px-4 py-2 text-sm text-gray-800 transition-transform duration-200 hover:scale-[1.02]">
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
                        <div key={i} className="mb-2 flex justify-end animate-[fadeIn_300ms_ease-out]">
                          <div className="max-w-[75%] rounded-2xl bg-blue-100 px-4 py-2 text-sm text-gray-800 transition-transform duration-200 hover:scale-[1.02]">{m.text}</div>
                        </div>
                      ) : (
                        <div key={m.id || i} className="mb-2 flex justify-start animate-[fadeIn_300ms_ease-out]">
                          <div className="max-w-[85%] w-full rounded-2xl bg-white px-4 py-2 text-sm text-gray-900 border text-left transition-transform duration-200 hover:scale-[1.01]">
                            {m.isStreaming && !m.text ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="animate-pulse">●</span>
                                <span className="animate-pulse delay-100">●</span>
                                <span className="animate-pulse delay-200">●</span>
                              </span>
                            ) : (
                              <div className="prose prose-sm prose-gray max-w-none [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>p]:mb-2 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5 [&>strong]:font-semibold [&>hr]:my-2">
                                <ReactMarkdown>{m.text || "…"}</ReactMarkdown>
                                {m.isStreaming && <span className="ml-1 animate-pulse">▌</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                {/* Bottom controls - stays at bottom */}
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Add">+</button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Settings">⚙</button>
                        Models
                      </span>
                      <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-md border px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-gray-400 transition-colors duration-150 cursor-pointer">
                        <option value="SOMA-CT-v1">SOMA-CT-v1</option>
                        <option value="SOMA-CT-v2">SOMA-CT-v2</option>
                        <option value="General-4o-mini">General-4o-mini</option>
                      </select>
                    </div>

                    <button
                      onClick={handleAnalysis}
                      className={`ml-3 rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-200 ease-out active:scale-95 ${
                        isAnalysisTriggered
                          ? 'border text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                          : 'bg-blue-600 text-white shadow hover:bg-blue-700 hover:shadow-md'
                      }`}
                      title="Generate report from current mask"
                    >
                      Analyse
                    </button>
                  </div>

                  <div className="flex items-start gap-2">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isRunning && question.trim()) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Enter your questions… (Press Enter to send)"
                      className="flex-1 h-24 resize-none rounded-xl border bg-blue-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-gray-400 transition-colors duration-150"
                    />
                    <button
                      onClick={sendMessage}
                      className={`h-10 shrink-0 rounded-md px-4 text-sm font-semibold transition-all duration-200 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 ${
                        isAnalysisTriggered
                          ? 'bg-blue-600 text-white shadow hover:bg-blue-700 hover:shadow-md'
                          : 'border text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                      }`}
                      title="Send (Enter)"
                      disabled={isRunning}
                    >
                      Send
                    </button>
                  </div>
                </div>
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
