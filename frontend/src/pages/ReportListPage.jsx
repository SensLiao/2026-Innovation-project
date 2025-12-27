/**
 * ReportListPage - 报告列表页 (类似 Google Docs)
 *
 * 功能:
 * - 显示所有已生成报告，按更新时间排序
 * - 每个卡片包含 Markdown 内容预览
 * - 支持状态筛选 (All / Draft / Approved)
 * - 支持搜索 (病人姓名/MRN/内容)
 * - 点击卡片进入详情页
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { FileText, Search, Clock } from "lucide-react";
import Header from "../components/Header";
import Logo from "../assets/images/Logo.png";
import { useReportStore } from "../stores/useReportStore";

/** Status Chip 组件 */
function StatusChip({ status }) {
  const styles = {
    draft: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    analyzing: "bg-blue-100 text-blue-700",
    default: "bg-gray-100 text-gray-700"
  };

  const displayStatus = status?.toLowerCase() || "draft";
  const style = styles[displayStatus] || styles.default;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase ${style}`}>
      {displayStatus}
    </span>
  );
}

/** 报告卡片组件 (带预览) */
function ReportCard({ report, onClick }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-300 p-3 cursor-pointer transition-all duration-200 group"
    >
      {/* Markdown 预览区 - 类似 Google Docs 文档预览 */}
      <div className="relative h-64 overflow-hidden rounded-lg bg-gray-50 border border-gray-200 mb-2 shadow-inner">
        {/* 状态标签 - 右上角 */}
        <div className="absolute top-2 right-2 z-10">
          <StatusChip status={report.status} />
        </div>
        {/* 模拟文档页面 - 居中白色区域 */}
        <div className="h-full flex justify-center pt-2 px-2">
          <div className="bg-white w-full max-w-[90%] h-full rounded shadow-sm p-3 overflow-hidden">
            <div className="text-[8px] leading-[1.4] text-gray-700 prose prose-xs max-w-none
              [&>h1]:text-[10px] [&>h1]:font-bold [&>h1]:mb-1 [&>h1]:text-gray-900 [&>h1]:text-center
              [&>h2]:text-[9px] [&>h2]:font-semibold [&>h2]:mb-1 [&>h2]:text-gray-800
              [&>h3]:text-[8px] [&>h3]:font-medium [&>h3]:mb-0.5
              [&>p]:mb-1 [&>p]:text-gray-600
              [&>ul]:my-0.5 [&>ul]:pl-2 [&>li]:my-0
              [&>hr]:my-1 [&>hr]:border-gray-200">
              <ReactMarkdown>
                {report.content?.slice(0, 800) || "No content"}
              </ReactMarkdown>
            </div>
          </div>
        </div>
        {/* 底部渐变遮罩 */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50 to-transparent" />
      </div>

      {/* 卡片信息 */}
      <div className="space-y-0.5">
        {/* 标题行: ID + 姓名 */}
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-900 truncate">
            #{report.id} | {report.patientName || "Unknown"}
          </span>
        </div>

        {/* MRN 行 */}
        <div className="text-xs text-gray-500 pl-5">
          {report.patientMrn || "No MRN"}
        </div>

        {/* 日期行 */}
        <div className="flex items-center gap-1 text-xs text-gray-400 pl-5">
          <Clock className="w-3 h-3" />
          <span>{formatDate(report.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

/** 筛选按钮组 */
function FilterTabs({ activeFilter, onFilterChange }) {
  const filters = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "approved", label: "Approved" }
  ];

  return (
    <div className="flex gap-2">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onFilterChange(f.key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeFilter === f.key
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** 主页面组件 */
const ReportListPage = () => {
  const navigate = useNavigate();
  const {
    reportsLoading,
    reportsError,
    filter,
    searchQuery,
    fetchReports,
    setFilter,
    setSearchQuery,
    getFilteredReports
  } = useReportStore();

  // 页面加载时获取报告列表
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = getFilteredReports();

  const handleCardClick = (reportId) => {
    navigate(`/report/${reportId}`);
  };

  return (
    <div className="min-h-screen bg-[#C2DCE7] py-8">
      {/* 主卡片容器 */}
      <div className="w-[1200px] mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 relative min-h-[80vh]">

          {/* Header */}
          <Header activeTab="report" showLogout={false} />

          {/* 页面标题 */}
          <div className="mt-8 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">SOMA Reports</h1>
            <p className="text-gray-500 text-sm mt-1">
              View and manage all diagnosis reports
            </p>
          </div>

          {/* 工具栏: 搜索 + 筛选 */}
          <div className="flex items-center justify-between mb-6">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 筛选按钮 */}
            <FilterTabs activeFilter={filter} onFilterChange={setFilter} />
          </div>

          {/* 报告列表 */}
          {reportsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : reportsError ? (
            <div className="flex items-center justify-center h-64 text-red-600">
              Error: {reportsError}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p>No reports found</p>
              {searchQuery && (
                <p className="text-sm mt-1">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onClick={() => handleCardClick(report.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportListPage;
