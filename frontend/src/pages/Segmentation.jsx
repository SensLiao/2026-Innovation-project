import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Header from "../components/Header";
import main from "../assets/images/Main.png";
import Decoration from "../assets/images/main2.png";
import "./patient.css";
import axios from "axios";
import ReportPanel from "../components/ReportPanel";
import SegmentationActionsBar from "../components/SegmentationActionsBar";
import UserGuide from "../components/UserGuide";
import { Eye, EyeOff, Trash2, ChevronDown, User, FileText, ExternalLink } from "lucide-react";
import { streamRequest, streamChat, ANALYSIS_PHASES, api } from "../lib/api";
import { useSegDB } from "../useDB/useSeg";
import { useAuth } from "../useDB/useAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

const SegmentationPage = () => {
  const [activeTab, setActiveTab] = useState("segmentation");
  const [fileName, setFileName] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reportText, setReportText] = useState(defaultReport);
  const [question, setQuestion] = useState("");
  const [targetAgent, setTargetAgent] = useState("auto"); // auto, radiologist, pathologist, report_writer
  const [model, setModel] = useState("SOMA-CT-v1");
  const { addSeg  } = useSegDB();
  const {user, fetchMe } = useAuth();
  const navigate = useNavigate();

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

  // Box 提示 (新增 - 点击两次画框)
  const [boxCoords, setBoxCoords] = useState([]); // [[x0, y0, x1, y1], ...]
  const [boxStart, setBoxStart] = useState(null); // {x, y} 第一次点击的起点
  const [tempBox, setTempBox] = useState(null); // 鼠标移动时的临时预览 box

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
  const [analysisStatus, setAnalysisStatus] = useState(null); // 'completed' | 'canceled' | 'failed' | null
  const abortControllerRef = useRef(null); // For canceling SSE requests
  const [sessionId, setSessionId] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('medicalReportSessionId') || null;
  });
  const [diagnosisId, setDiagnosisId] = useState(null);
  const [reportStatus, setReportStatus] = useState('draft'); // 'draft' | 'approved'

  const inputRef = useRef(null);
  const currentFileRef = useRef(null); // Track current file to prevent memory leaks
  const messagesEndRef = useRef(null); // For auto-scrolling chat messages

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

  // 工具切换时清理之前的标记
  useEffect(() => {
    // 切换工具时清除对应的标记
    if (tool === "point") {
      setBoxCoords([]);
      setTempBox(null);
    } else if (tool === "box") {
      // Box 工具不清除 points,允许混合使用
    }
  }, [tool]);

  // ═══════════════════════════════════════════════════════════════════════════
  // iter4: Patient & Clinical Context - 病人信息与临床上下文
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * 病人选择与临床上下文状态管理
   *
   * 功能：
   * - 病人下拉选择 (从数据库加载)
   * - 自动填充历史临床上下文
   * - 临床指征、吸烟史、既往影像等输入
   * - 检查类型自动识别 (Claude Vision)
   *
   * 安全措施：
   * - 使用 isCurrent 标志防止异步竞态条件
   * - 使用 currentFileRef 防止内存泄漏
   */
  const [patientInfoOpen, setPatientInfoOpen] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [clinicalContext, setClinicalContext] = useState({
    clinicalIndication: '',
    examType: 'CT Chest',
    smokingHistory: { status: 'never', packYears: 0 },
    relevantHistory: '',
    priorImagingDate: ''
  });

  /**
   * 加载病人列表 (组件挂载时)
   * 用于前端下拉选择器
   */
  useEffect(() => {
    async function fetchPatients() {
      try {
        const res = await api.get('/patients');
        setPatients(res.data.data || res.data.patients || []);
      } catch (err) {
        console.error('Failed to fetch patients:', err);
      }
    }
    fetchPatients();
  }, []);

  /**
   * 病人选择变更处理
   *
   * 职责：
   * - 获取病人详细信息
   * - 获取该病人最新诊断记录
   * - 自动填充临床上下文 (如有历史记录)
   *
   * 竞态条件防护：
   * - 使用 isCurrent 标志跟踪当前请求
   * - 如果用户在请求完成前切换病人，丢弃旧响应
   * - cleanup 函数在组件卸载或依赖变化时设置 isCurrent = false
   */
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      return;
    }

    let isCurrent = true; // 竞态条件防护：防止过期数据更新

    async function fetchPatientInfo() {
      try {
        const res = await api.get(`/patients/${selectedPatientId}`);
        if (!isCurrent) return; // Selection changed, abort
        setSelectedPatient(res.data.patient || res.data.data || null);

        // Also fetch latest diagnosis for this patient to auto-fill clinical context
        const diagRes = await api.get(`/diagnosis/patient/${selectedPatientId}/latest`);
        if (!isCurrent) return; // Selection changed, abort
        if (diagRes.data.success && diagRes.data.diagnosis?.clinicalContext) {
          const ctx = diagRes.data.diagnosis.clinicalContext;
          setClinicalContext({
            clinicalIndication: ctx.clinicalIndication || '',
            examType: ctx.examType || 'CT Chest',
            smokingHistory: ctx.smokingHistory || { status: 'never', packYears: 0 },
            relevantHistory: ctx.relevantHistory || '',
            priorImagingDate: ctx.priorImagingDate ? ctx.priorImagingDate.split('T')[0] : ''
          });
        }
      } catch (err) {
        if (isCurrent) {
          console.error('Failed to fetch patient info:', err);
        }
      }
    }
    fetchPatientInfo();

    return () => { isCurrent = false; }; // Cleanup on unmount or re-run
  }, [selectedPatientId]);

  // Helper to update clinical context fields
  const updateClinicalContext = (field, value) => {
    setClinicalContext(prev => ({ ...prev, [field]: value }));
  };
  const updateSmokingHistory = (field, value) => {
    setClinicalContext(prev => ({
      ...prev,
      smokingHistory: { ...prev.smokingHistory, [field]: value }
    }));
  };

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

  // Auto-scroll to latest message in chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 文件处理 - 图像上传与模型加载
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * handleFile - 医学图像处理管道
   *
   * 职责：
   * 1. 转换文件为 DataURL 并预览
   * 2. 调用 /api/load_model 获取图像嵌入
   * 3. 调用 /api/classify_image 自动识别检查类型 (Claude Vision)
   * 4. 更新 UI 状态
   *
   * 内存泄漏防护：
   * - 使用 currentFileRef 追踪当前处理的文件
   * - 每个异步步骤后检查文件是否变更
   * - 若用户上传新文件，立即中止旧文件的处理流程
   *
   * 状态管理：
   * - finally 块确保 isRunning 在所有情况下重置 (包括 early return)
   */
  async function handleFile(f) {
    setFileName(f.name);
    setIsRunning(true);
    currentFileRef.current = f; // 内存泄漏防护：追踪当前文件

    try {
      const dataURL = await fileToDataURL(f);
      if (currentFileRef.current !== f) return; // File changed, abort
      setUploadedImage(dataURL);
      console.log(dataURL)

      const { natW, natH } = await loadImageOffscreen(dataURL);
      if (currentFileRef.current !== f) return;
      setOrigImSize([natH, natW]);

      const im = new Image();
      im.src = dataURL;
      imgElRef.current = im;

      const form = new FormData();
      form.append("image", f);
      const resp = await axios.post(`${API_BASE}/load_model`, form);
      if (currentFileRef.current !== f) return;
      setImageEmbeddings(resp.data.image_embeddings || []);
      setEmbeddingsDims(resp.data.embedding_dims || []);

      // Auto-classify image type using Claude Vision
      try {
        const classifyResp = await api.post('/classify_image', { imageData: dataURL });
        if (currentFileRef.current !== f) return; // File changed during classification
        if (classifyResp.data.success && classifyResp.data.classification) {
          const { examType, modality, bodyPart, contrast } = classifyResp.data.classification;
          // Map to dropdown options
          const examTypeMap = {
            'CT Chest': 'CT Chest',
            'CT Chest with Contrast': 'CT Chest with Contrast',
            'Low-dose CT Chest': 'Low-dose CT Chest',
            'CT Abdomen': 'CT Abdomen',
            'CT Abdomen with Contrast': 'CT Abdomen',
            'MRI Brain': 'MRI Brain',
            'MRI Brain with Contrast': 'MRI Brain',
            'X-ray Chest': 'X-ray Chest',
            'Chest X-ray': 'X-ray Chest',
          };
          // Try exact match first, then construct from modality+bodyPart
          let detectedExamType = examTypeMap[examType];
          if (!detectedExamType && modality && bodyPart) {
            const constructed = `${modality} ${bodyPart}${contrast ? ' with Contrast' : ''}`;
            detectedExamType = examTypeMap[constructed] || constructed;
          }
          if (detectedExamType) {
            updateClinicalContext('examType', detectedExamType);
            console.log('[AutoClassify] Detected exam type:', detectedExamType);
          }
        }
      } catch (classifyErr) {
        console.warn('[AutoClassify] Classification failed (non-critical):', classifyErr.message);
      }

      if (currentFileRef.current !== f) return;
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

  // 画面内点击 -> 记录点或处理 box
  function handleContainerClick(e) {
    if (!uploadedImage || !fileName) {
      handleBrowse();
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

    // Point 工具: 添加点
    if (tool === "point") {
      setClickPoints((prev) => [...prev, { x, y }]);
      setPointLabels((prev) => [...prev, mode === "foreground" ? 1 : 0]);
    }
    // Box 工具: 点击两次确定 box
    else if (tool === "box") {
      if (!boxStart) {
        // 第一次点击: 设置起点
        setBoxStart({ x, y });
        setTempBox(null);
      } else {
        // 第二次点击: 确定终点，创建 box
        const x0 = Math.min(boxStart.x, x);
        const y0 = Math.min(boxStart.y, y);
        const x1 = Math.max(boxStart.x, x);
        const y1 = Math.max(boxStart.y, y);

        // 确保 box 有最小尺寸
        const minSize = 0.01;
        if (x1 - x0 > minSize && y1 - y0 > minSize) {
          setBoxCoords([{ x0, y0, x1, y1 }]);
        }
        setBoxStart(null);
        setTempBox(null);
      }
    }
  }

  // Box 工具的 mouse move 事件处理 (实时预览)
  function handleMouseMove(e) {
    // 只有在 box 工具且已设置起点时才显示预览
    if (tool !== "box" || !boxStart || !dropZoneRef.current) return;

    const hostRect = dropZoneRef.current.getBoundingClientRect();
    const imgRect = getImageRect();
    if (!imgRect) return;

    const localX = e.clientX - hostRect.left - imgRect.offsetX;
    const localY = e.clientY - hostRect.top - imgRect.offsetY;

    // 限制在图像范围内
    const clampedX = Math.max(0, Math.min(localX, imgRect.drawW));
    const clampedY = Math.max(0, Math.min(localY, imgRect.drawH));

    const x = clampedX / imgRect.drawW;
    const y = clampedY / imgRect.drawH;

    // 计算矩形 (左上角到右下角)
    const x0 = Math.min(boxStart.x, x);
    const y0 = Math.min(boxStart.y, y);
    const x1 = Math.max(boxStart.x, x);
    const y1 = Math.max(boxStart.y, y);

    setTempBox({ x0, y0, x1, y1 });
  }

  // 运行模型（支持点和框）
  async function runModel() {
    if (!uploadedImage || !imageEmbeddings?.length) {
      alert("请先上传图片并等待后端返回 embeddings");
      return;
    }
    
    // 检查是否有任何 prompt (点或框)
    const hasPoints = clickPoints.length > lastRunIndex;
    const hasBoxes = boxCoords.length > 0;
    
    if (!hasPoints && !hasBoxes) {
      alert("请先添加点或绘制框再运行模型");
      return;
    }

    const newPts = clickPoints.slice(lastRunIndex);
    const newLabs = pointLabels.slice(lastRunIndex);

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
    const toBoxes = (arr) => (Array.isArray(arr) ? arr.map((b) => [
      Math.round(b.x0 * W), 
      Math.round(b.y0 * H), 
      Math.round(b.x1 * W), 
      Math.round(b.y1 * H)
    ]) : []);

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
    const sendBoxes = toBoxes(boxCoords);

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
        boxes: toPlainArray(sendBoxes), // 新增 boxes 参数
        mask_input: refinedMask ? toPlainArray(refinedMask) : null,
        has_mask_input: refinedFlag,
        orig_im_size: [H, W],
        hint_type: hasBoxes ? (hasPoints ? "combined" : "box") : "point",
      };

      const res = await axios.post(`${API_BASE}/run_model`, body);
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
    setBoxCoords([]); // 清除 boxes
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

    // 绘制 boxes (包括临时的拖拽框)
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // 绘制已确认的 box
    boxCoords.forEach((box) => {
      const x = rect.offsetX + box.x0 * rect.drawW;
      const y = rect.offsetY + box.y0 * rect.drawH;
      const w = (box.x1 - box.x0) * rect.drawW;
      const h = (box.y1 - box.y0) * rect.drawH;
      ctx.strokeRect(x, y, w, h);
    });

    // 绘制临时预览框
    if (tempBox) {
      ctx.strokeStyle = "#FFFF00";
      const x = rect.offsetX + tempBox.x0 * rect.drawW;
      const y = rect.offsetY + tempBox.y0 * rect.drawH;
      const w = (tempBox.x1 - tempBox.x0) * rect.drawW;
      const h = (tempBox.y1 - tempBox.y0) * rect.drawH;
      ctx.strokeRect(x, y, w, h);
    }

    // 绘制 box 起点标记 (当已点击第一个点但还未点击第二个点时)
    if (boxStart && !tempBox) {
      ctx.fillStyle = "#FFFF00";
      const cx = rect.offsetX + boxStart.x * rect.drawW;
      const cy = rect.offsetY + boxStart.y * rect.drawH;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }, [masks, uploadedImage, origImSize, redrawTick, activeTab, boxCoords, tempBox, boxStart]);

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
      
      // 保存到数据库
      await addSeg({
        uid: user.uid,
        pid: 1,
        model: model,
        uploadimage: uploadedImage,
        origimsize: origImSize,
        masks: masks,
      });

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
    // 如果有 box,优先清除 box
    if (boxCoords.length > 0) {
      setBoxCoords([]);
      setRedrawTick((t) => t + 1);
      return;
    }
    
    // 否则撤销最后一个点
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
    setBoxCoords([]); // 清除 boxes
    setLastRunIndex(0);

    setMasks([]);
    setCurrentMaskIndex(0);
    setRedrawTick((t) => t + 1);
  }

  // 取消分析
  function cancelAnalysis() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAnalysisStatus('canceled');
    setShowCompletion(true);
    setTimeout(() => {
      setShowCompletion(false);
      setAnalysisStatus(null);
      setAnalysisProgress(null);
      setIsRunning(false);
    }, 2000);
  }

  // Approve report
  async function handleApprove() {
    if (!diagnosisId) {
      alert('No diagnosis to approve');
      return;
    }
    try {
      const res = await api.post(`/diagnosis/${diagnosisId}/approve`);
      if (res.data.success) {
        setReportStatus('approved');
      }
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Failed to approve report');
    }
  }

  // 生成报告 (支持 SSE 流式进度)
  async function handleAnalysis(useStreaming = true) {
    // Validation: Check if patient is selected (show friendly animation instead of alert)
    if (!selectedPatient) {
      setAnalysisStatus('no_patient');
      setShowCompletion(true);
      setTimeout(() => {
        setShowCompletion(false);
        setAnalysisStatus(null);
      }, 2500);
      return;
    }
    if (!imageEmbeddings.length) {
      setAnalysisStatus('no_image');
      setShowCompletion(true);
      setTimeout(() => {
        setShowCompletion(false);
        setAnalysisStatus(null);
      }, 2500);
      return;
    }
    if (!imgElRef.current || !masks || masks.length === 0) {
      setAnalysisStatus('no_mask');
      setShowCompletion(true);
      setTimeout(() => {
        setShowCompletion(false);
        setAnalysisStatus(null);
      }, 2500);
      return;
    }
    setIsRunning(true);
    setAgentLogs([]); // Clear previous logs
    setAnalysisStatus(null); // Reset status
    setAnalysisProgress({ step: 'preparing', label: 'Preparing image...', progress: 5, agent: null });
    abortControllerRef.current = new AbortController(); // Create new abort controller

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
        // SSE 流式请求 (iter4: include patientInfo and clinicalContext)
        const requestBody = {
          final_image: image_base64,
          patientInfo: selectedPatient ? {
            id: selectedPatient.pid,
            name: selectedPatient.name,
            age: selectedPatient.age,
            gender: selectedPatient.gender,
            mrn: selectedPatient.mrn,
            dob: selectedPatient.dateofbirth
          } : null,
          clinicalContext: clinicalContext
        };
        await streamRequest('/medical_report_stream', requestBody, {
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
            if (data.diagnosisId) {
              setDiagnosisId(data.diagnosisId);
              setReportStatus('draft');
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

            // Save diagnosisId from complete event
            if (data.diagnosisId) {
              setDiagnosisId(data.diagnosisId);
              setReportStatus('draft');
            }

            // Show completion animation
            setAnalysisProgress({ step: 'complete', label: 'Report Generated', progress: 100, agent: null });
            setAnalysisStatus('completed');
            setShowCompletion(true);

            // Hide completion animation after 2 seconds and switch to report tab
            setTimeout(() => {
              setShowCompletion(false);
              setAnalysisStatus(null);
              setAnalysisProgress(null);
              setIsRunning(false);
              setActiveTab("report");
              setIsAnalysisTriggered(true);
            }, 2000);
          },
          onError: (err) => {
            console.error('[SSE Error]', err);
            // Check if it was aborted (canceled)
            if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
              return; // Already handled by cancelAnalysis
            }
            setAnalysisStatus('failed');
            setShowCompletion(true);
            setTimeout(() => {
              setShowCompletion(false);
              setAnalysisStatus(null);
              setAnalysisProgress(null);
              setIsRunning(false);
            }, 2000);
          }
        });
      } else {
        // Fallback: 普通 POST 请求 (iter4: include patientInfo and clinicalContext)
        const res = await axios.post(`${API_BASE}/medical_report_init`, {
          final_image: image_base64,
          patientInfo: selectedPatient ? {
            id: selectedPatient.pid,
            name: selectedPatient.name,
            age: selectedPatient.age,
            gender: selectedPatient.gender,
            mrn: selectedPatient.mrn,
            dob: selectedPatient.dateofbirth
          } : null,
          clinicalContext: clinicalContext
        });
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
        { message: content, sessionId: sessionId || undefined, targetAgent: targetAgent !== 'auto' ? targetAgent : undefined },
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
      { id: "foreground", label: "Foreground pattern" },
      { id: "background", label: "Background pattern" },
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
                <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full mx-4 relative">
                  {showCompletion ? (
                    /* Status Animation (Success/Canceled/Failed) */
                    <div className="flex flex-col items-center justify-center py-4 animate-[fadeIn_300ms_ease-out]">
                      {analysisStatus === 'completed' ? (
                        /* Success - Blue Checkmark */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-blue-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-blue-700 mb-1">Report Generated</h3>
                          <p className="text-gray-500 text-sm">Completed successfully</p>
                        </>
                      ) : analysisStatus === 'canceled' ? (
                        /* Canceled - Orange/Yellow X */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-amber-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-amber-700 mb-1">Analysis Canceled</h3>
                          <p className="text-gray-500 text-sm">You can restart anytime</p>
                        </>
                      ) : analysisStatus === 'no_patient' ? (
                        /* No Patient Selected - Purple Warning */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-purple-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-purple-700 mb-1">Patient Required</h3>
                          <p className="text-gray-500 text-sm">Please select a patient before generating report</p>
                        </>
                      ) : analysisStatus === 'no_image' ? (
                        /* No Image - Blue Warning */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-blue-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-blue-700 mb-1">Image Required</h3>
                          <p className="text-gray-500 text-sm">Please upload an image and wait for processing</p>
                        </>
                      ) : analysisStatus === 'no_mask' ? (
                        /* No Mask - Teal Warning */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-teal-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-teal-700 mb-1">Segmentation Required</h3>
                          <p className="text-gray-500 text-sm">Please click on the image to create a mask first</p>
                        </>
                      ) : (
                        /* Failed - Red X */
                        <>
                          <div className="relative mb-4">
                            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center animate-[scaleIn_400ms_ease-out]">
                              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 h-16 w-16 rounded-full bg-red-400 animate-ping opacity-20" />
                          </div>
                          <h3 className="text-xl font-bold text-red-700 mb-1">Generation Failed</h3>
                          <p className="text-gray-500 text-sm">Please try again</p>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Progress Animation - Clean & Minimal */
                    <div className="py-2">
                      {/* Cancel button - top right */}
                      <button
                        onClick={cancelAnalysis}
                        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Cancel analysis"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {/* Spinner + Text row */}
                      <div className="flex items-center gap-4 mb-5">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 flex-shrink-0" />
                        <div className="text-left">
                          {analysisProgress?.agent && (
                            <p className="text-sm font-medium text-sky-500 mb-0.5 text-left">
                              {analysisProgress.agent}
                            </p>
                          )}
                          <p className="text-blue-700 font-semibold text-xl text-left">
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


            {/* Left-Right panel container - items-stretch ensures equal height */}
            <div className="mt-20 md:mt-28 relative z-10 flex flex-col md:flex-row md:items-stretch gap-6">

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
                    data-tour="report-tab"
                    onClick={() => setActiveTab("report")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm transition-all duration-200 ease-out active:scale-95 ${
                      activeTab === "report" 
                        ? "bg-blue-600/90 text-white shadow-md" 
                        : "bg-gray-300 text-gray-700 hover:bg-gray-400 hover:shadow"
                    }`}
                  >
                    Report
                  </button>
                  {/* Open in Editor button - show on Report tab */}
                  {activeTab === "report" && (
                    <button
                      onClick={() => diagnosisId && navigate(`/report/${diagnosisId}`)}
                      disabled={!diagnosisId}
                      className={`rounded-md px-3 py-1 text-xs font-semibold shadow-sm transition-all duration-200 ease-out active:scale-95 flex items-center gap-1 ${
                        diagnosisId
                          ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow"
                          : "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                      title={diagnosisId ? "Open report in full editor" : "Generate a report first"}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in Editor
                    </button>
                  )}
                </div>

                {activeTab === "segmentation" ? (
                  <>
                    {/* ======= Patient Info Bar (always visible above image) ======= */}
                    {selectedPatient && (
                      <div className="mb-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
                              {selectedPatient.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{selectedPatient.name}</div>
                              <div className="text-xs text-gray-500">{selectedPatient.mrn || 'No MRN'}</div>
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600">
                            <span className="px-2 py-0.5 bg-white rounded-full border">{selectedPatient.age} years</span>
                            <span className="px-2 py-0.5 bg-white rounded-full border">{selectedPatient.gender}</span>
                            {clinicalContext.smokingHistory?.status !== 'never' && clinicalContext.smokingHistory?.packYears > 0 && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-300">
                                {clinicalContext.smokingHistory.packYears} pack-years
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedPatientId(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title="Clear patient selection"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* 上传区 */}
                    <div
                      data-tour="upload-zone"
                      ref={dropZoneRef}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={handleContainerClick}
                      onMouseMove={handleMouseMove}
                      className="group relative flex h-[360px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200 ease-out"
                      title={uploadedImage ? (tool === "point" ? "点击添加标注点" : (boxStart ? "点击确定框的终点" : "点击确定框的起点")) : "点击选择文件或拖拽图片到此处"}
                      style={{ cursor: tool === "box" && uploadedImage ? "crosshair" : "pointer" }}
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
                    <div data-tour="segmentation-tools" className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {/* Tool & Mode 选择器放在一行 */}
                      <div className="col-span-2 md:col-span-4 flex items-center gap-4 border-b border-gray-200 pb-3">
                        {/* Tool 选择 (Point/Box) */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">TOOL</span>
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => setTool("point")}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                tool === "point"
                                  ? "bg-white text-blue-600 shadow-sm"
                                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                              }`}
                              aria-label="Point tool"
                              aria-pressed={tool === "point"}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                              </svg>
                              <span>Point</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setTool("box")}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                                tool === "box"
                                  ? "bg-white text-blue-600 shadow-sm"
                                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                              }`}
                              aria-label="Box tool"
                              aria-pressed={tool === "box"}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                              </svg>
                              <span>Box</span>
                            </button>
                          </div>
                        </div>

                        {/* 分隔线 */}
                        <div className="h-6 w-px bg-gray-300"></div>

                        {/* Mode 选择 (Foreground/Background) - Box 工具时禁用 */}
                        <div className={`flex items-center gap-2 transition-opacity duration-200 ${tool === "box" ? "opacity-40 pointer-events-none" : ""}`}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">MODE</span>
                          {segOptions.map((opt) => (
                            <label key={opt.id} className={`inline-flex items-center gap-1 text-sm transition-colors duration-150 ${tool === "box" ? "text-gray-400 cursor-not-allowed" : "text-gray-700 cursor-pointer hover:text-gray-900"}`}>
                              <input 
                                type="radio" 
                                name="mode" 
                                value={opt.id} 
                                checked={mode === opt.id} 
                                onChange={() => setMode(opt.id)} 
                                disabled={tool === "box"}
                                className="h-4 w-4 accent-blue-600 disabled:cursor-not-allowed" 
                              />
                              <span className="select-none">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-span-2 md:col-span-4">
                        <SegmentationActionsBar
                          onRunModel={runModel}
                          onUndoPoints={undoPoints}
                          onStartNextMask={startNextMask}
                          onResetImage={resetImage}
                          onExportOverlay={handleExportOverlay}
                          isRunning={isRunning}
                          disableRunModel={!fileName || (clickPoints.length === 0 && boxCoords.length === 0)}
                          disableUndoPoints={clickPoints.length === 0 && boxCoords.length === 0}
                          showExport={uploadedImage && masks && masks.length > 0}
                        />
                      </div>

                      {/* ======= iter4: Patient & Clinical Context (collapsible) ======= */}
                      <div data-tour="patient-info-section" className="col-span-2 md:col-span-4">
                        <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setPatientInfoOpen((o) => !o)}
                            className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none transition-colors duration-150"
                          >
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Patient & Clinical Context
                              {selectedPatient && <span className="text-xs text-green-600 font-normal">({selectedPatient.name})</span>}
                            </span>
                            {patientInfoOpen ? (
                              <span className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-full transition-colors duration-150 shadow-sm">
                                Confirm
                              </span>
                            ) : (
                              <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                            )}
                          </button>

                          <div
                            className={`
                              overflow-hidden transition-all duration-300 ease-in-out
                              ${patientInfoOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
                            `}
                          >
                            <div className="px-4 py-3 border-t border-gray-200 space-y-3">
                              {/* Patient Selection */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Patient</label>
                                <select
                                  value={selectedPatientId || ''}
                                  onChange={(e) => setSelectedPatientId(e.target.value ? Number(e.target.value) : null)}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">-- Select Patient --</option>
                                  {patients.map(p => (
                                    <option key={p.pid} value={p.pid}>
                                      {p.name} ({p.mrn || 'No MRN'}) - {p.age}yo {p.gender}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Clinical Indication */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Clinical Indication</label>
                                <textarea
                                  value={clinicalContext.clinicalIndication}
                                  onChange={(e) => updateClinicalContext('clinicalIndication', e.target.value)}
                                  placeholder="e.g., Rule out pulmonary nodule, follow-up for prior abnormality..."
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-16 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              {/* Exam Type */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Exam Type</label>
                                  <select
                                    value={clinicalContext.examType}
                                    onChange={(e) => updateClinicalContext('examType', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="CT Chest">CT Chest</option>
                                    <option value="CT Chest with Contrast">CT Chest with Contrast</option>
                                    <option value="Low-dose CT Chest">Low-dose CT Chest (Screening)</option>
                                    <option value="CT Abdomen">CT Abdomen</option>
                                    <option value="MRI Brain">MRI Brain</option>
                                    <option value="X-ray Chest">X-ray Chest</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Prior Imaging Date</label>
                                  <input
                                    type="date"
                                    value={clinicalContext.priorImagingDate}
                                    onChange={(e) => updateClinicalContext('priorImagingDate', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>

                              {/* Smoking History */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Smoking History</label>
                                <div className="flex items-center gap-3">
                                  <select
                                    value={clinicalContext.smokingHistory.status}
                                    onChange={(e) => updateSmokingHistory('status', e.target.value)}
                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="never">Never smoker</option>
                                    <option value="former">Former smoker</option>
                                    <option value="current">Current smoker</option>
                                    <option value="unknown">Unknown</option>
                                  </select>
                                  {(clinicalContext.smokingHistory.status === 'former' || clinicalContext.smokingHistory.status === 'current') && (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={clinicalContext.smokingHistory.packYears}
                                        onChange={(e) => updateSmokingHistory('packYears', parseInt(e.target.value) || 0)}
                                        className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-500">pack-years</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Relevant History */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Relevant Medical History</label>
                                <textarea
                                  value={clinicalContext.relevantHistory}
                                  onChange={(e) => updateClinicalContext('relevantHistory', e.target.value)}
                                  placeholder="e.g., Hypertension, Diabetes, Family history of lung cancer..."
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-16 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ======= 新：折叠式 Masks List（默认关闭；最多显示 2 项） ======= */}
                      <div data-tour="masks-section" className="col-span-2 md:col-span-4">
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
                    samples={{ medical: sampleGeneratedReport, formal: defaultReport }}
                    uploadedImage={uploadedImage}
                    masks={masks}
                    origImSize={origImSize}
                    status={reportStatus}
                    onApprove={handleApprove}
                  />
                )}
              </div>

              {/* Right: Chat */}
                <div data-tour="chat-section" className="md:basis-2/5 rounded-2xl border bg-white p-4 shadow-sm flex flex-col h-[600px]">

                {/* Messages area - fixed height with scroll */}
                <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-3 mb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
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
                          <div className="max-w-[75%] rounded-2xl bg-blue-100 px-4 py-2 text-sm text-gray-800 text-left transition-transform duration-200 hover:scale-[1.02]">{m.text}</div>
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
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom controls - stays at bottom */}
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Add">+</button>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Settings">⚙</button>
                        Agent
                      </span>
                      <select value={targetAgent} onChange={(e) => setTargetAgent(e.target.value)} className="rounded-md border px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-gray-400 transition-colors duration-150 cursor-pointer">
                        <option value="auto">Auto (Smart Routing)</option>
                        <option value="radiologist">Radiology Analysis Agent</option>
                        <option value="pathologist">Pathology Diagnosis Agent</option>
                        <option value="report_writer">Report Drafting Agent</option>
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
      
      {/* User Guide Button - Fixed at bottom right */}
      <UserGuide />
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
