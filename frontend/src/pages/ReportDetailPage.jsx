/**
 * ReportDetailPage - 报告详情页 (Canvas 风格)
 *
 * 布局: 70% 编辑器 : 30% Chat
 *
 * 功能:
 * - 左侧: Markdown 编辑器 + Diff 高亮
 * - 右侧: AI 对话框 (ChatPanel)
 * - Accept All / Revert All 按钮
 * - Save Draft / Approve 按钮
 * - 版本历史下拉
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, CheckCircle, Check, X, Undo2, Redo2 } from "lucide-react";
import Header from "../components/Header";
import ChatPanel from "../components/report/ChatPanel";
import ReportEditor from "../components/report/ReportEditor";
import VersionHistoryDropdown from "../components/report/VersionHistoryDropdown";
import { useReportStore } from "../stores/useReportStore";

const ReportDetailPage = () => {
  const { diagnosisId: id } = useParams();
  const navigate = useNavigate();

  const {
    currentReport,
    reportLoading,
    reportError,
    showDiff,
    previousContent,
    versions,
    versionsLoading,
    undoStack,
    redoStack,
    fetchReport,
    fetchVersions,
    loadVersion,
    resetCurrentReport,
    updateContent,
    handleAIRevision,
    acceptAll,
    revertAll,
    undo,
    redo,
    saveVersion,
    approveReport
  } = useReportStore();

  const [currentVersion, setCurrentVersion] = useState(null);

  useEffect(() => {
    let isMounted = true;

    if (id) {
      const diagnosisId = parseInt(id, 10);
      // Reset version state when navigating to different report
      setCurrentVersion(null);

      // Fetch data
      fetchReport(diagnosisId);
      fetchVersions(diagnosisId);
    }

    return () => {
      isMounted = false;
      // Only reset when actually unmounting (navigating away)
      // Don't reset during StrictMode double-invoke
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => resetCurrentReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 选择版本 (显示与 v1 的 diff)
  const handleSelectVersion = async (versionNumber) => {
    setCurrentVersion(versionNumber);

    // 加载对应版本内容
    if (versionNumber === null) {
      // 回到最新版本
      await fetchReport(parseInt(id, 10));
    } else {
      await loadVersion(parseInt(id, 10), versionNumber);
    }

    // 显示与 v1 的 diff (v1 本身不显示 diff)
    if (versionNumber === 1) {
      // v1 是基准，不需要 diff
      useReportStore.setState({
        previousContent: null,
        showDiff: false
      });
    } else if (versions.length > 0) {
      // Latest 或 v2+ 都显示与 v1 的 diff
      const v1 = versions.find(v => v.versionNumber === 1);
      if (v1 && v1.content) {
        useReportStore.setState({
          previousContent: v1.content,
          showDiff: true
        });
      }
    }
  };

  // 处理 AI 修改报告
  const handleRevision = (newContent, changes) => {
    const oldContent = currentReport?.reportContent || "";
    handleAIRevision(oldContent, newContent);
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!currentReport?.reportContent) return;
    const result = await saveVersion(parseInt(id, 10), currentReport.reportContent);
    if (result) {
      alert(`Saved as version ${result.versionNumber}`);
    }
  };

  // 审批
  const handleApprove = async () => {
    const success = await approveReport(parseInt(id, 10));
    if (success) {
      alert("Report approved!");
    }
  };

  if (reportLoading) {
    return (
      <div className="min-h-screen bg-[#C2DCE7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (reportError) {
    return (
      <div className="min-h-screen bg-[#C2DCE7] flex items-center justify-center">
        <div className="text-red-600">Error: {reportError}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#C2DCE7] py-8">
      <div className="w-[1200px] mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 min-h-[85vh]">

          {/* Header */}
          <Header activeTab="report" showLogout={false} />

          {/* 顶部信息栏 */}
          <div className="mt-6 flex items-center justify-between border-b pb-4 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/report")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold">
                  Report #{id} | {currentReport?.patientInfo?.name || "Loading..."}
                </h1>
                <p className="text-sm text-gray-500">
                  MRN: {currentReport?.patientInfo?.mrn || "—"}
                </p>
              </div>
            </div>

            {/* 状态 + 操作按钮 */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${
                currentReport?.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}>
                {currentReport?.status || "draft"}
              </span>

              <button
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>

              <button
                onClick={handleApprove}
                disabled={currentReport?.status === "approved"}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  currentReport?.status === "approved"
                    ? "bg-green-100 text-green-700 cursor-default"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                {currentReport?.status === "approved" ? "Approved" : "Approve"}
              </button>
            </div>
          </div>

          {/* 主内容区: 70% 编辑器 : 30% Chat */}
          <div className="flex gap-6 h-[calc(85vh-200px)]">

            {/* 左侧: 编辑器区域 (70%) */}
            <div className="flex-[7] flex flex-col">
              <div className="flex-1 bg-gray-50 rounded-xl border overflow-hidden">
                <ReportEditor
                  content={currentReport?.reportContent || ""}
                  previousContent={previousContent}
                  showDiff={showDiff}
                  onChange={(value) => updateContent(value)}
                  readOnly={currentReport?.status === "approved"}
                />
              </div>

              {/* Diff 操作栏 */}
              <div className="mt-3 flex items-center justify-between text-sm">
                {/* 左侧: Versions + Undo/Redo */}
                <div className="flex items-center gap-2">
                  <VersionHistoryDropdown
                    versions={versions}
                    currentVersion={currentVersion}
                    onSelectVersion={handleSelectVersion}
                    isLoading={versionsLoading}
                  />
                  {/* Undo/Redo 按钮 */}
                  <div className="flex items-center gap-1 border-l pl-2 ml-1">
                    <button
                      onClick={undo}
                      disabled={undoStack.length === 0}
                      className={`p-1.5 rounded transition-colors ${
                        undoStack.length > 0
                          ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          : "text-gray-300 cursor-not-allowed"
                      }`}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={redo}
                      disabled={redoStack.length === 0}
                      className={`p-1.5 rounded transition-colors ${
                        redoStack.length > 0
                          ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          : "text-gray-300 cursor-not-allowed"
                      }`}
                      title="Redo (Ctrl+Shift+Z)"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 右侧: Accept All / Revert All 按钮 (仅在有 Diff 时显示) */}
                {showDiff && (
                  <div className="flex gap-2">
                    <button
                      onClick={acceptAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-md text-xs font-medium transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept All
                    </button>
                    <button
                      onClick={revertAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs font-medium transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Revert All
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧: Chat 区域 (30%) */}
            <div className="flex-[3] bg-white rounded-xl border p-4">
              <ChatPanel
                diagnosisId={parseInt(id, 10)}
                onRevision={handleRevision}
                showAnalyseButton={false}
              />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default ReportDetailPage;
