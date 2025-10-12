import React, { useState, useRef, useEffect } from "react";
import { Settings2, Undo2, PlusSquare, RotateCcw, Download } from "lucide-react";

/**
 * SegmentationActionsBar
 * 
 * 可访问的工具栏组件，包含主操作按钮和下拉菜单中的次级操作。
 * 
 * @param {Object} props
 * @param {Function} props.onRunModel - Run Model 回调
 * @param {Function} props.onUndoPoints - Undo Points 回调
 * @param {Function} props.onStartNextMask - Start Next Mask 回调
 * @param {Function} props.onResetImage - Reset Image 回调
 * @param {Function} props.onExportOverlay - Export PNG 回调（可选）
 * @param {boolean} props.isRunning - 是否正在运行（禁用主按钮）
 * @param {boolean} props.disableRunModel - 是否禁用 Run Model 按钮
 * @param {boolean} props.disableUndoPoints - 是否禁用 Undo Points
 * @param {boolean} props.showExport - 是否显示 Export 选项
 */
const SegmentationActionsBar = ({
  onRunModel,
  onUndoPoints,
  onStartNextMask,
  onResetImage,
  onExportOverlay,
  isRunning = false,
  disableRunModel = false,
  disableUndoPoints = false,
  showExport = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusedMenuItemIndex, setFocusedMenuItemIndex] = useState(0);
  
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const menuItemsRef = useRef([]);

  // 菜单项配置（带图标和颜色）
  const menuItems = [
    { 
      icon: Undo2, 
      label: "Undo Points", 
      onClick: onUndoPoints, 
      disabled: disableUndoPoints,
      color: "text-amber-600",
      hoverBg: "hover:bg-amber-50"
    },
    { 
      icon: PlusSquare, 
      label: "Start Next Mask", 
      onClick: onStartNextMask, 
      disabled: false,
      color: "text-emerald-600",
      hoverBg: "hover:bg-emerald-50"
    },
    { 
      icon: RotateCcw, 
      label: "Reset Image", 
      onClick: onResetImage, 
      disabled: false,
      color: "text-rose-600",
      hoverBg: "hover:bg-rose-50"
    },
  ];

  // 如果需要显示导出，添加到菜单
  if (showExport) {
    menuItems.push({
      icon: Download,
      label: "Export PNG",
      onClick: onExportOverlay,
      disabled: false,
      color: "text-blue-600",
      hoverBg: "hover:bg-blue-50"
    });
  }

  // 切换菜单开关
  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
    if (!menuOpen) {
      setFocusedMenuItemIndex(0);
    }
  };

  // 关闭菜单并返回焦点
  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  // 处理菜单项点击
  const handleMenuItemClick = (item) => {
    if (!item.disabled) {
      item.onClick();
    }
    closeMenu();
  };

  // 工具栏按钮键盘导航（roving tabindex）
  const handleToolbarKeyDown = (e) => {
    // 左右箭头可用于在工具栏按钮间移动（此处只有一个按钮，预留扩展）
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      // 目前只有一个按钮，无需实际移动焦点
    }
    // Enter/Space 打开菜单
    if ((e.key === "Enter" || e.key === " ") && !menuOpen) {
      e.preventDefault();
      toggleMenu();
    }
  };

  // 菜单键盘导航
  const handleMenuKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedMenuItemIndex((prev) => {
        const next = (prev + 1) % menuItems.length;
        return next;
      });
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedMenuItemIndex((prev) => {
        const next = (prev - 1 + menuItems.length) % menuItems.length;
        return next;
      });
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const item = menuItems[focusedMenuItemIndex];
      if (item && !item.disabled) {
        handleMenuItemClick(item);
      }
    }
  };

  // 焦点管理：当菜单打开时，聚焦到第一个菜单项
  useEffect(() => {
    if (menuOpen && menuItemsRef.current[focusedMenuItemIndex]) {
      menuItemsRef.current[focusedMenuItemIndex].focus();
    }
  }, [menuOpen, focusedMenuItemIndex]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target)
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* 左侧：主操作按钮 */}
      <button
        type="button"
        className="group inline-flex items-center justify-center h-11 px-8 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 ease-out active:scale-95"
        onClick={onRunModel}
        disabled={isRunning || disableRunModel}
        aria-busy={isRunning ? "true" : "false"}
        aria-label="Run segmentation model"
      >
        <span className="relative">
          {isRunning ? (
            <>
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </span>
            </>
          ) : (
            <span className="group-hover:tracking-wide transition-all duration-200">Run Model</span>
          )}
        </span>
      </button>

      {/* 右侧：工具栏（工具按钮） */}
      <div
        role="toolbar"
        aria-label="Segmentation tools"
        className="flex items-center justify-end"
      >
        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            className={`group inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white text-blue-700 hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-50 hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-200 ease-out shadow-md hover:shadow-lg active:scale-95 ${
              menuOpen ? 'ring-2 ring-blue-400 ring-offset-1 shadow-lg' : ''
            }`}
            aria-label="Segmentation tools menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="seg-tools-menu"
            onClick={toggleMenu}
            onKeyDown={handleToolbarKeyDown}
            tabIndex={0}
          >
            <Settings2 
              className={`h-5 w-5 transition-transform duration-300 ease-out ${
                menuOpen ? 'rotate-90' : 'group-hover:rotate-12'
              }`} 
              aria-hidden="true" 
            />
            <span className="text-sm font-semibold group-hover:tracking-wide transition-all duration-200">Tools</span>
          </button>

          {/* 下拉菜单 */}
          {menuOpen && (
            <div
              id="seg-tools-menu"
              ref={menuRef}
              role="menu"
              aria-label="More actions"
              className="absolute right-0 z-50 mt-2 min-w-[12rem] rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl animate-menu-in backdrop-blur-sm"
              onKeyDown={handleMenuKeyDown}
              style={{
                animation: 'menuFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'top right'
              }}
            >
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isFocused = focusedMenuItemIndex === index;
                return (
                  <button
                    key={index}
                    ref={(el) => (menuItemsRef.current[index] = el)}
                    role="menuitem"
                    type="button"
                    className={`group w-full flex items-center gap-3 text-left rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ease-out ${
                      item.disabled
                        ? "text-gray-400 cursor-not-allowed opacity-50"
                        : `${item.color} ${item.hoverBg} hover:pl-4 hover:shadow-sm focus:bg-gray-100 active:scale-95`
                    } ${isFocused ? 'ring-1 ring-blue-400' : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600`}
                    onClick={() => handleMenuItemClick(item)}
                    disabled={item.disabled}
                    tabIndex={-1}
                    onFocus={() => setFocusedMenuItemIndex(index)}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animation: 'menuItemSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1) backwards'
                    }}
                  >
                    <Icon 
                      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                        !item.disabled ? 'group-hover:scale-110' : ''
                      }`} 
                      aria-hidden="true" 
                    />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes menuFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes menuItemSlideIn {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-menu-in {
          animation: menuFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};

export default SegmentationActionsBar;
