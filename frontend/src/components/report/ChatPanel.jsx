/**
 * ChatPanel - 可复用的 AI 对话组件
 *
 * 用于:
 * - Segmentation 页面 (带 Analyse 按钮)
 * - ReportDetailPage 页面 (不带 Analyse 按钮)
 *
 * Props:
 * - messages: 消息列表 [{role, text, isStreaming}]
 * - onSendMessage: 发送消息回调
 * - isLoading: 是否正在加载
 * - sessionId: 会话 ID
 * - showAnalyseButton: 是否显示 Analyse 按钮
 * - onAnalyse: Analyse 按钮回调
 * - isAnalysisTriggered: 是否已触发分析
 * - onRevision: AI 修改报告时的回调
 */

import React, { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { streamChat } from "../../lib/api";

/** 默认提示消息 */
const defaultMessages = [
  {
    role: "user",
    text: "Can you help me with this report?",
    isExample: true
  },
  {
    role: "assistant",
    text: "Of course! I can help you review, edit, or answer questions about the report.",
    isExample: true
  }
];

const ChatPanel = ({
  messages: externalMessages = [],
  sessionId = null,
  diagnosisId = null,  // For loading existing report state
  showAnalyseButton = false,
  onAnalyse = null,
  isAnalysisTriggered = false,
  onRevision = null,
  className = "",
}) => {
  const [messages, setMessages] = useState(externalMessages);
  const [question, setQuestion] = useState("");
  const [targetAgent, setTargetAgent] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track mounted state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 同步外部消息
  useEffect(() => {
    if (externalMessages.length > 0) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const sendMessage = async () => {
    if (!question.trim() || isLoading) return;

    const userMessage = { role: "user", text: question.trim() };
    const assistantMessage = {
      role: "assistant",
      text: "",
      isStreaming: true,
      id: Date.now()
    };

    setMessages(prev => [...prev.filter(m => !m.isExample), userMessage, assistantMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      await streamChat(
        {
          message: question.trim(),
          sessionId,
          diagnosisId,
          mode: "auto",
          targetAgent: targetAgent === "auto" ? null : targetAgent
        },
        {
          onChunk: (chunk, fullText) => {
            if (!isMountedRef.current) return;
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.text = fullText;
              }
              return updated;
            });
          },
          onRevision: (data) => {
            if (!isMountedRef.current) return;
            // AI 修改了报告
            if (onRevision && data.updatedReport) {
              onRevision(data.updatedReport, data.changes || []);
            }
          },
          onDone: () => {
            if (!isMountedRef.current) return;
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.isStreaming = false;
              }
              return updated;
            });
            setIsLoading(false);
          },
          onError: (err) => {
            if (!isMountedRef.current) return;
            console.error("[ChatPanel] Error:", err);
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.text = "Sorry, an error occurred. Please try again.";
                lastMsg.isStreaming = false;
              }
              return updated;
            });
            setIsLoading(false);
          }
        }
      );
    } catch (error) {
      console.error("[ChatPanel] Send error:", error);
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // 显示的消息（有消息显示消息，否则显示默认提示）
  const displayMessages = messages.length > 0 ? messages : defaultMessages;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-3 mb-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
        {displayMessages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="mb-2 flex justify-end animate-[fadeIn_300ms_ease-out]">
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm text-left transition-transform duration-200 hover:scale-[1.02] ${
                m.isExample ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-gray-800"
              }`}>
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id || i} className="mb-2 flex justify-start animate-[fadeIn_300ms_ease-out]">
              <div className={`max-w-[85%] w-full rounded-2xl px-4 py-2 text-sm text-left border transition-transform duration-200 hover:scale-[1.01] ${
                m.isExample ? "bg-gray-50 text-gray-500" : "bg-white text-gray-900"
              }`}>
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
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部控制区 */}
      <div className="mt-auto space-y-3">
        {/* Agent 选择器 + Analyse 按钮 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Add">+</button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 active:scale-90" title="Settings">⚙</button>
              Agent
            </span>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="rounded-md border px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 hover:border-gray-400 transition-colors duration-150 cursor-pointer"
            >
              <option value="auto">Auto (Smart Routing)</option>
              <option value="radiologist">Radiology Analysis Agent</option>
              <option value="pathologist">Pathology Diagnosis Agent</option>
              <option value="report_writer">Report Drafting Agent</option>
            </select>
          </div>

          {/* Analyse 按钮 (仅 Segmentation 页面显示) */}
          {showAnalyseButton && onAnalyse && (
            <button
              onClick={onAnalyse}
              className={`ml-3 rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-200 ease-out active:scale-95 ${
                isAnalysisTriggered
                  ? 'border text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                  : 'bg-blue-600 text-white shadow hover:bg-blue-700 hover:shadow-md'
              }`}
              title="Generate report from current mask"
            >
              Analyse
            </button>
          )}
        </div>

        {/* 输入框 + 发送按钮 */}
        <div className="flex items-start gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading && question.trim()) {
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
              showAnalyseButton && isAnalysisTriggered
                ? 'bg-blue-600 text-white shadow hover:bg-blue-700 hover:shadow-md'
                : showAnalyseButton
                  ? 'border text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                  : 'bg-blue-600 text-white shadow hover:bg-blue-700 hover:shadow-md'
            }`}
            title="Send (Enter)"
            disabled={isLoading || !question.trim()}
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
