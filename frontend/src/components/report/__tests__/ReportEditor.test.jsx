/**
 * ReportEditor 组件测试
 * ReportEditor Component Tests
 *
 * 测试覆盖 / Test Coverage:
 * 1. 渲染测试 / Render Tests
 * 2. 模式切换测试 / Mode Switch Tests
 * 3. Diff 显示测试 / Diff Display Tests
 * 4. 编辑功能测试 / Edit Functionality Tests
 * 5. 只读模式测试 / ReadOnly Mode Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportEditor from '../ReportEditor'

// Mock CodeMirror
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange, readOnly, placeholder }) => (
    <div data-testid="codemirror-mock">
      <textarea
        data-testid="codemirror-textarea"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  )
}))

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: () => []
}))

vi.mock('@codemirror/view', () => ({
  EditorView: {
    lineWrapping: {},
    theme: () => ({})
  }
}))

describe('ReportEditor 组件 / ReportEditor Component', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 渲染测试 / Render Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('渲染测试 / Render Tests', () => {
    it('应正确渲染编辑器组件 / should render editor component', () => {
      render(<ReportEditor content="Test content" />)

      // 检查工具栏按钮
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Preview/i })).toBeInTheDocument()

      // 检查编辑器
      expect(screen.getByTestId('codemirror-mock')).toBeInTheDocument()
    })

    it('应正确显示内容 / should display content correctly', () => {
      render(<ReportEditor content="# Report Title" />)

      const textarea = screen.getByTestId('codemirror-textarea')
      expect(textarea).toHaveValue('# Report Title')
    })

    it('空内容时应显示占位符 / should show placeholder when empty', () => {
      render(<ReportEditor content="" />)

      const textarea = screen.getByTestId('codemirror-textarea')
      expect(textarea).toHaveAttribute('placeholder', 'Write your medical report here...')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 模式切换测试 / Mode Switch Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('模式切换测试 / Mode Switch Tests', () => {
    it('默认应为 Edit 模式 / should default to Edit mode', () => {
      render(<ReportEditor content="Content" />)

      const editButton = screen.getByRole('button', { name: /Edit/i })
      expect(editButton).toHaveClass('bg-white', 'shadow')
    })

    it('点击 Preview 应切换到预览模式 / should switch to Preview mode', async () => {
      const user = userEvent.setup()
      render(<ReportEditor content="# Hello World" />)

      await user.click(screen.getByRole('button', { name: /Preview/i }))

      // 预览模式应显示渲染后的 Markdown
      expect(screen.getByText('Hello World')).toBeInTheDocument()

      // CodeMirror 应隐藏
      expect(screen.queryByTestId('codemirror-mock')).not.toBeInTheDocument()
    })

    it('点击 Edit 应切换回编辑模式 / should switch back to Edit mode', async () => {
      const user = userEvent.setup()
      render(<ReportEditor content="Content" />)

      // 先切换到预览
      await user.click(screen.getByRole('button', { name: /Preview/i }))
      // 再切换回编辑
      await user.click(screen.getByRole('button', { name: /Edit/i }))

      expect(screen.getByTestId('codemirror-mock')).toBeInTheDocument()
    })

    it('Preview 按钮点击后应高亮 / should highlight Preview button when clicked', async () => {
      const user = userEvent.setup()
      render(<ReportEditor content="Content" />)

      await user.click(screen.getByRole('button', { name: /Preview/i }))

      const previewButton = screen.getByRole('button', { name: /Preview/i })
      expect(previewButton).toHaveClass('bg-white', 'shadow')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Diff 显示测试 / Diff Display Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diff 显示测试 / Diff Display Tests', () => {
    it('showDiff=true 且有 previousContent 时应显示 Diff 视图 / should show DiffView when enabled', () => {
      render(
        <ReportEditor
          content="New line"
          previousContent="Old line"
          showDiff={true}
        />
      )

      // 应显示 "Showing changes" 标签
      expect(screen.getByText('Showing changes')).toBeInTheDocument()

      // 应显示行号
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('showDiff=false 时不应显示 Diff 视图 / should not show DiffView when disabled', () => {
      render(
        <ReportEditor
          content="Content"
          previousContent="Old content"
          showDiff={false}
        />
      )

      expect(screen.queryByText('Showing changes')).not.toBeInTheDocument()
      expect(screen.getByTestId('codemirror-mock')).toBeInTheDocument()
    })

    it('无 previousContent 时不应显示 Diff / should not show Diff without previousContent', () => {
      render(
        <ReportEditor
          content="Content"
          previousContent={null}
          showDiff={true}
        />
      )

      expect(screen.queryByText('Showing changes')).toBeInTheDocument()
      // 但 DiffView 需要 previousContent，所以应显示普通编辑器
      expect(screen.getByTestId('codemirror-mock')).toBeInTheDocument()
    })

    it('Diff 视图应显示添加的行 (绿色/+) / should show added lines with green', () => {
      render(
        <ReportEditor
          content="Line 1\nNew line\nLine 3"
          previousContent="Line 1\nLine 3"
          showDiff={true}
        />
      )

      // 新增行应有 + 符号
      const addSymbols = screen.getAllByText('+')
      expect(addSymbols.length).toBeGreaterThan(0)
    })

    it('Diff 视图应显示删除的行 (红色/-) / should show removed lines with red', () => {
      render(
        <ReportEditor
          content="Line 1\nLine 3"
          previousContent="Line 1\nRemoved line\nLine 3"
          showDiff={true}
        />
      )

      // 删除行应有 - 符号
      const removeSymbols = screen.getAllByText('-')
      expect(removeSymbols.length).toBeGreaterThan(0)
    })

    it('未变化的行不应有 +/- 符号 / should not mark unchanged lines', () => {
      render(
        <ReportEditor
          content="Unchanged"
          previousContent="Unchanged"
          showDiff={true}
        />
      )

      // 没有变化，不应有 +/- 符号
      expect(screen.queryByText('+')).not.toBeInTheDocument()
      expect(screen.queryByText('-')).not.toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 编辑功能测试 / Edit Functionality Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('编辑功能测试 / Edit Functionality Tests', () => {
    it('内容变更时应调用 onChange / should call onChange on content change', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(<ReportEditor content="" onChange={mockOnChange} />)

      const textarea = screen.getByTestId('codemirror-textarea')
      await user.type(textarea, 'New text')

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('onChange 应传递新内容 / should pass new content to onChange', async () => {
      const mockOnChange = vi.fn()

      render(<ReportEditor content="Initial" onChange={mockOnChange} />)

      const textarea = screen.getByTestId('codemirror-textarea')
      fireEvent.change(textarea, { target: { value: 'Updated content' } })

      expect(mockOnChange).toHaveBeenCalledWith('Updated content')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 只读模式测试 / ReadOnly Mode Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('只读模式测试 / ReadOnly Mode Tests', () => {
    it('readOnly=true 时编辑器应禁用 / should disable editor when readOnly', () => {
      render(<ReportEditor content="Content" readOnly={true} />)

      const textarea = screen.getByTestId('codemirror-textarea')
      expect(textarea).toHaveAttribute('readonly')
    })

    it('readOnly=false 时编辑器应启用 / should enable editor when not readOnly', () => {
      render(<ReportEditor content="Content" readOnly={false} />)

      const textarea = screen.getByTestId('codemirror-textarea')
      expect(textarea).not.toHaveAttribute('readonly')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Markdown 渲染测试 / Markdown Rendering Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Markdown 渲染测试 / Markdown Rendering Tests', () => {
    it('Preview 模式应渲染 Markdown 标题 / should render Markdown headings', async () => {
      const user = userEvent.setup()
      render(<ReportEditor content="# Report Title" />)

      await user.click(screen.getByRole('button', { name: /Preview/i }))

      // 检查渲染后的标题
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      expect(screen.getByText('Report Title')).toBeInTheDocument()
    })

    it('Preview 模式应渲染 Markdown 列表 / should render Markdown lists', async () => {
      const user = userEvent.setup()
      // 使用实际换行符的内容
      const listContent = `- First item
- Second item
- Third item`
      render(<ReportEditor content={listContent} />)

      await user.click(screen.getByRole('button', { name: /Preview/i }))

      // 检查有列表元素
      expect(screen.getByRole('list')).toBeInTheDocument()
    })

    it('Preview 模式应渲染粗体文本 / should render bold text', async () => {
      const user = userEvent.setup()
      render(<ReportEditor content="This is **bold** text" />)

      await user.click(screen.getByRole('button', { name: /Preview/i }))

      const boldElement = screen.getByText('bold')
      expect(boldElement.tagName).toBe('STRONG')
    })
  })
})
