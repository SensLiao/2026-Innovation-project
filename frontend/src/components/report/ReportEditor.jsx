/**
 * ReportEditor - CodeMirror Markdown 编辑器 + Diff 高亮
 *
 * 功能:
 * - Markdown 编辑 (CodeMirror)
 * - Diff 高亮显示 AI 修改 (红删/绿增)
 * - Edit / Preview 模式切换
 *
 * Props:
 * - content: 当前报告内容
 * - previousContent: AI 修改前的内容 (用于 Diff)
 * - showDiff: 是否显示 Diff 高亮
 * - onChange: 内容变更回调
 * - readOnly: 是否只读
 */

import React, { useState, useMemo, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { diffLines } from "diff";
import ReactMarkdown from "react-markdown";
import { Edit3, Eye, Check, X } from "lucide-react";

/** Diff 高亮主题 - GitHub/VSCode 风格 */
const diffTheme = EditorView.theme({
  ".cm-line.diff-added": {
    backgroundColor: "rgba(46, 160, 67, 0.4)",
    borderLeft: "4px solid #2ea043"
  },
  ".cm-line.diff-removed": {
    backgroundColor: "rgba(248, 81, 73, 0.4)",
    borderLeft: "4px solid #f85149",
    textDecoration: "line-through"
  }
});

/** 计算 Diff 并生成行装饰 */
function computeDiffDecorations(oldContent, newContent) {
  // Ensure both are strings
  const oldStr = typeof oldContent === 'string' ? oldContent : String(oldContent || '');
  const newStr = typeof newContent === 'string' ? newContent : String(newContent || '');

  if (!oldStr || !newStr) return { decorations: [], mergedLines: [] };

  const changes = diffLines(oldStr, newStr);
  const mergedLines = [];
  const lineClasses = [];

  changes.forEach((change) => {
    const lines = change.value.split("\n").filter((_, i, arr) =>
      i < arr.length - 1 || arr[i] !== ""
    );

    lines.forEach((line) => {
      if (change.added) {
        mergedLines.push(line);
        lineClasses.push("added");
      } else if (change.removed) {
        mergedLines.push(line);
        lineClasses.push("removed");
      } else {
        mergedLines.push(line);
        lineClasses.push(null);
      }
    });
  });

  return { mergedLines, lineClasses };
}

/** Diff 视图组件 - 浅色模式，悬停显示 ✓/✗ 按钮 */
function DiffView({ oldContent, newContent, onLineDecision }) {
  const { mergedLines, lineClasses } = useMemo(
    () => computeDiffDecorations(oldContent, newContent),
    [oldContent, newContent]
  );

  // 记录每个修改行的决定状态
  const [decisions, setDecisions] = useState({});

  const handleDecision = (lineIndex, accept) => {
    setDecisions(prev => ({ ...prev, [lineIndex]: accept }));
    onLineDecision?.(lineIndex, accept);
  };

  return (
    <div className="font-mono text-sm whitespace-pre-wrap bg-white text-gray-800 overflow-hidden">
      {mergedLines.map((line, i) => {
        const isAdded = lineClasses[i] === "added";
        const isRemoved = lineClasses[i] === "removed";
        const decision = decisions[i];

        return (
          <div
            key={i}
            className={`group flex leading-6 ${
              isAdded
                ? decision === false ? "bg-gray-100 opacity-50" : "bg-green-50 border-l-4 border-green-400"
                : isRemoved
                ? decision === true ? "bg-gray-100 opacity-50" : "bg-red-50 border-l-4 border-red-400 line-through text-gray-400"
                : "border-l-4 border-transparent"
            }`}
          >
            {/* 行号 */}
            <span className="w-12 min-w-[3rem] px-2 py-0.5 text-gray-400 text-right select-none bg-gray-50 border-r border-gray-200">
              {i + 1}
            </span>
            {/* +/- 符号 */}
            <span className={`w-6 text-center py-0.5 font-medium ${
              isAdded ? "text-green-600" : isRemoved ? "text-red-400" : ""
            }`}>
              {isAdded ? "+" : isRemoved ? "-" : ""}
            </span>
            {/* 内容 */}
            <span className="flex-1 px-2 py-0.5">{line || " "}</span>
            {/* 悬停显示的 ✓/✗ 按钮 - 只在新增行显示 */}
            {isAdded && decision === undefined && (
              <div className="hidden group-hover:flex items-center gap-1 pr-2">
                <button
                  onClick={() => handleDecision(i, true)}
                  className="p-0.5 rounded hover:bg-green-200 text-green-600 transition-colors"
                  title="Accept this change"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDecision(i, false)}
                  className="p-0.5 rounded hover:bg-red-200 text-red-500 transition-colors"
                  title="Reject this change"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {/* 已决定的状态指示 */}
            {isAdded && decision !== undefined && (
              <div className="flex items-center pr-2">
                {decision ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ReportEditor = ({
  content = "",
  previousContent = null,
  showDiff = false,
  onChange,
  readOnly = false
}) => {
  const [mode, setMode] = useState("edit"); // 'edit' | 'preview'

  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      diffTheme
    ],
    []
  );

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("edit")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === "edit"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => setMode("preview")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              mode === "preview"
                ? "bg-white shadow text-gray-900"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>

        {showDiff && (
          <span className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-gray-100 rounded-full">
            Showing changes
          </span>
        )}
      </div>

      {/* 编辑器/预览区 */}
      <div className="flex-1 overflow-auto bg-white rounded-b-xl">
        {mode === "preview" ? (
          <div className="p-4 prose prose-sm prose-gray max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : showDiff && previousContent ? (
          <DiffView oldContent={previousContent} newContent={content} />
        ) : (
          <CodeMirror
            value={content}
            extensions={extensions}
            onChange={onChange}
            readOnly={readOnly}
            placeholder="Write your medical report here..."
            className="h-full"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
              highlightActiveLine: true,
              highlightSelectionMatches: true
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ReportEditor;
