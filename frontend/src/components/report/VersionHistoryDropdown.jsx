/**
 * VersionHistoryDropdown - 版本历史下拉菜单
 *
 * 功能:
 * - 显示版本列表 (版本号、时间、来源)
 * - 点击版本加载对应内容
 * - 高亮当前版本
 *
 * Props:
 * - versions: 版本列表 [{versionNumber, createdAt, changeType, changeSource}]
 * - currentVersion: 当前选中版本号
 * - onSelectVersion: 选择版本回调
 * - isLoading: 加载中状态
 */

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Clock, Bot, User, Sparkles } from "lucide-react";

/** 版本来源图标 */
function SourceIcon({ changeSource, changeType }) {
  if (changeType === "ai_generated") {
    return <Sparkles className="w-3 h-3 text-purple-500" />;
  }
  if (changeSource === "ai") {
    return <Bot className="w-3 h-3 text-blue-500" />;
  }
  return <User className="w-3 h-3 text-gray-500" />;
}

/** 格式化时间 */
function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** 格式化变更类型 */
function formatChangeType(type) {
  const labels = {
    ai_generated: "AI Generated",
    ai_revised: "AI Revised",
    user_save: "Manual Save"
  };
  return labels[type] || type;
}

const VersionHistoryDropdown = ({
  versions = [],
  currentVersion = null,
  onSelectVersion,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayText = currentVersion
    ? `Version ${currentVersion}`
    : versions.length > 0
    ? "Latest"
    : "No versions";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={versions.length === 0}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
          versions.length === 0
            ? "text-gray-400 border-gray-200 cursor-not-allowed"
            : "text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        {displayText}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && versions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border z-50 max-h-64 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Loading versions...
            </div>
          ) : (
            <div className="py-1">
              {/* Latest 选项 */}
              <button
                onClick={() => {
                  onSelectVersion(null);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  currentVersion === null ? "bg-blue-50 text-blue-700" : ""
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-700">L</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium">Latest</div>
                  <div className="text-xs text-gray-500">Current working version</div>
                </div>
              </button>

              <div className="border-t my-1" />

              {/* 历史版本列表 */}
              {versions.map((v) => (
                <button
                  key={v.versionNumber}
                  onClick={() => {
                    onSelectVersion(v.versionNumber);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    currentVersion === v.versionNumber ? "bg-blue-50 text-blue-700" : ""
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">
                      {v.versionNumber}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">v{v.versionNumber}</span>
                      <SourceIcon changeSource={v.changeSource} changeType={v.changeType} />
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {formatTime(v.createdAt)} • {formatChangeType(v.changeType)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionHistoryDropdown;
