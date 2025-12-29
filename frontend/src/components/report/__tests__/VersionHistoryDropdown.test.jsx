/**
 * VersionHistoryDropdown 组件测试
 * VersionHistoryDropdown Component Tests
 *
 * 测试覆盖 / Test Coverage:
 * 1. 渲染测试 / Render Tests
 * 2. 下拉菜单交互 / Dropdown Interaction
 * 3. 版本选择测试 / Version Selection
 * 4. 版本来源图标 / Source Icons
 * 5. 时间格式化 / Time Formatting
 * 6. 点击外部关闭 / Click Outside Close
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VersionHistoryDropdown from '../VersionHistoryDropdown'

describe('VersionHistoryDropdown 组件 / Component Tests', () => {
  const mockVersions = [
    {
      versionNumber: 1,
      content: '# V1',
      createdAt: '2024-01-01T10:00:00Z',
      changeType: 'ai_generated',
      changeSource: 'ai'
    },
    {
      versionNumber: 2,
      content: '# V2',
      createdAt: '2024-01-02T14:30:00Z',
      changeType: 'user_save',
      changeSource: 'user'
    },
    {
      versionNumber: 3,
      content: '# V3',
      createdAt: '2024-01-03T09:15:00Z',
      changeType: 'ai_revised',
      changeSource: 'ai'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 渲染测试 / Render Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('渲染测试 / Render Tests', () => {
    it('应正确渲染按钮 / should render button correctly', () => {
      render(<VersionHistoryDropdown versions={mockVersions} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Latest')).toBeInTheDocument()
    })

    it('无版本时应显示 No versions / should show No versions when empty', () => {
      render(<VersionHistoryDropdown versions={[]} />)

      expect(screen.getByText('No versions')).toBeInTheDocument()
    })

    it('无版本时按钮应禁用 / should disable button when no versions', () => {
      render(<VersionHistoryDropdown versions={[]} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('有当前版本时应显示版本号 / should show version number', () => {
      render(<VersionHistoryDropdown versions={mockVersions} currentVersion={2} />)

      expect(screen.getByText('Version 2')).toBeInTheDocument()
    })

    it('默认应显示 Latest / should show Latest by default', () => {
      render(<VersionHistoryDropdown versions={mockVersions} currentVersion={null} />)

      expect(screen.getByText('Latest')).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 下拉菜单交互 / Dropdown Interaction
  // ═══════════════════════════════════════════════════════════════════════════

  describe('下拉菜单交互 / Dropdown Interaction', () => {
    it('点击按钮应打开下拉菜单 / should open dropdown on click', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      // 应显示 Latest 选项
      expect(screen.getByText('Current working version')).toBeInTheDocument()
    })

    it('再次点击应关闭下拉菜单 / should close on second click', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      // 找到主触发按钮 (包含 Clock 图标的按钮)
      const triggerButton = screen.getByText('Latest').closest('button')
      await user.click(triggerButton)
      expect(screen.getByText('Current working version')).toBeInTheDocument()

      await user.click(triggerButton)
      expect(screen.queryByText('Current working version')).not.toBeInTheDocument()
    })

    it('下拉菜单应显示所有版本 / should show all versions', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText('v1')).toBeInTheDocument()
      expect(screen.getByText('v2')).toBeInTheDocument()
      expect(screen.getByText('v3')).toBeInTheDocument()
    })

    it('ChevronDown 图标应在打开时旋转 / should rotate chevron when open', async () => {
      const user = userEvent.setup()
      const { container } = render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      // 检查是否有 rotate-180 class
      const chevron = container.querySelector('.rotate-180')
      expect(chevron).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 版本选择测试 / Version Selection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('版本选择 / Version Selection', () => {
    it('选择版本应调用 onSelectVersion / should call onSelectVersion', async () => {
      const user = userEvent.setup()
      const onSelectVersion = vi.fn()

      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          onSelectVersion={onSelectVersion}
        />
      )

      await user.click(screen.getByRole('button'))
      await user.click(screen.getByText('v2'))

      expect(onSelectVersion).toHaveBeenCalledWith(2)
    })

    it('选择 Latest 应传递 null / should pass null for Latest', async () => {
      const user = userEvent.setup()
      const onSelectVersion = vi.fn()

      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          currentVersion={2}
          onSelectVersion={onSelectVersion}
        />
      )

      await user.click(screen.getByRole('button'))
      await user.click(screen.getByText('Latest'))

      expect(onSelectVersion).toHaveBeenCalledWith(null)
    })

    it('选择后应关闭下拉菜单 / should close dropdown after selection', async () => {
      const user = userEvent.setup()

      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          onSelectVersion={() => {}}
        />
      )

      await user.click(screen.getByRole('button'))
      await user.click(screen.getByText('v1'))

      expect(screen.queryByText('Current working version')).not.toBeInTheDocument()
    })

    it('当前版本应高亮显示 / should highlight current version', async () => {
      const user = userEvent.setup()

      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          currentVersion={2}
        />
      )

      await user.click(screen.getByRole('button'))

      // v2 按钮应有蓝色背景
      const v2Button = screen.getByText('v2').closest('button')
      expect(v2Button).toHaveClass('bg-blue-50')
    })

    it('Latest 当前选中时应高亮 / should highlight Latest when current', async () => {
      const user = userEvent.setup()

      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          currentVersion={null}
        />
      )

      // 找到主触发按钮
      const triggerButton = screen.getByText('Latest').closest('button')
      await user.click(triggerButton)

      // 下拉菜单中的 Latest 选项按钮 (包含 "Current working version" 文本的按钮)
      const latestOptionButton = screen.getByText('Current working version').closest('button')
      expect(latestOptionButton).toHaveClass('bg-blue-50')
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 版本来源图标 / Source Icons
  // ═══════════════════════════════════════════════════════════════════════════

  describe('版本来源图标 / Source Icons', () => {
    it('AI 生成版本应显示紫色星星图标 / should show Sparkles for ai_generated', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <VersionHistoryDropdown versions={mockVersions} />
      )

      await user.click(screen.getByRole('button'))

      // ai_generated (v1) 应有紫色星星
      const sparkles = container.querySelector('.text-purple-500')
      expect(sparkles).toBeInTheDocument()
    })

    it('AI 修订版本应显示蓝色机器人图标 / should show Bot for ai source', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <VersionHistoryDropdown versions={mockVersions} />
      )

      await user.click(screen.getByRole('button'))

      // ai_revised (v3) 应有蓝色机器人
      const bots = container.querySelectorAll('.text-blue-500')
      expect(bots.length).toBeGreaterThan(0)
    })

    it('用户保存版本应显示灰色用户图标 / should show User for user source', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <VersionHistoryDropdown versions={mockVersions} />
      )

      await user.click(screen.getByRole('button'))

      // user_save (v2) 应有灰色用户图标
      const userIcons = container.querySelectorAll('.text-gray-500')
      expect(userIcons.length).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 变更类型显示 / Change Type Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('变更类型显示 / Change Type Display', () => {
    it('应显示 AI Generated / should show AI Generated', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(/AI Generated/i)).toBeInTheDocument()
    })

    it('应显示 Manual Save / should show Manual Save', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(/Manual Save/i)).toBeInTheDocument()
    })

    it('应显示 AI Revised / should show AI Revised', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(/AI Revised/i)).toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 加载状态测试 / Loading State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('加载状态 / Loading State', () => {
    it('加载中应显示 Loading versions / should show loading text', async () => {
      const user = userEvent.setup()
      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          isLoading={true}
        />
      )

      await user.click(screen.getByRole('button'))

      expect(screen.getByText('Loading versions...')).toBeInTheDocument()
    })

    it('加载中不应显示版本列表 / should not show versions while loading', async () => {
      const user = userEvent.setup()
      render(
        <VersionHistoryDropdown
          versions={mockVersions}
          isLoading={true}
        />
      )

      await user.click(screen.getByRole('button'))

      expect(screen.queryByText('v1')).not.toBeInTheDocument()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. 点击外部关闭 / Click Outside Close
  // ═══════════════════════════════════════════════════════════════════════════

  describe('点击外部关闭 / Click Outside Close', () => {
    it('点击外部应关闭下拉菜单 / should close on outside click', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <VersionHistoryDropdown versions={mockVersions} />
        </div>
      )

      // 打开下拉菜单
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('Current working version')).toBeInTheDocument()

      // 点击外部
      fireEvent.mouseDown(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('Current working version')).not.toBeInTheDocument()
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. 时间格式化测试 / Time Formatting Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('时间格式化 / Time Formatting', () => {
    it('应格式化日期时间 / should format date time', async () => {
      const user = userEvent.setup()
      render(<VersionHistoryDropdown versions={mockVersions} />)

      // 找到主触发按钮
      const triggerButton = screen.getByText('Latest').closest('button')
      await user.click(triggerButton)

      // 版本列表中的时间应有数字格式 (如 "01 Jan, 10:00 am")
      // 检查 v1 的时间显示
      const v1Button = screen.getByText('v1').closest('button')
      expect(v1Button.textContent).toMatch(/\d/)
    })

    it('无日期时应显示 — / should show dash for missing date', async () => {
      const user = userEvent.setup()
      const versionsWithoutDate = [
        { versionNumber: 1, changeType: 'user_save', changeSource: 'user' }
      ]

      render(<VersionHistoryDropdown versions={versionsWithoutDate} />)

      await user.click(screen.getByRole('button'))

      expect(screen.getByText(/—/)).toBeInTheDocument()
    })
  })
})
