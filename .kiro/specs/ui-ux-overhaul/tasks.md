# Implementation Plan: UI/UX Overhaul

## Overview

将 Codex Manager 应用升级为 Glassmorphism 风格，包括配色方案、基础组件、特性组件重构和动画系统。采用渐进式实现，确保每个阶段都可验证。

## Tasks

- [x] 1. 设置设计系统基础
  - [x] 1.1 扩展 tailwind.config.js 配色和工具类
    - 添加 primary 青色系配色
    - 添加 glass 透明度颜色
    - 添加 backdropBlur、boxShadow、animation 扩展
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3_
  - [x] 1.2 更新 index.css 添加 Glassmorphism 工具类
    - 添加 .glass、.glass-strong、.glass-hover 类
    - 添加 .glow-border、.glow-border-strong 类
    - 添加 .text-gradient、.btn-gradient 类
    - 添加 reduced-motion 媒体查询
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 9.1, 9.5_

- [x] 2. 创建基础 UI 组件
  - [x] 2.1 创建 CircularProgress 组件
    - 实现 SVG 环形进度条
    - 实现颜色映射逻辑 (emerald/amber/rose)
    - 实现中心百分比文字显示
    - 添加发光效果
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 2.2 编写 CircularProgress 属性测试
    - **Property 2: ProgressIndicator Value and Color Mapping**
    - **Validates: Requirements 6.2, 6.3**
  - [x] 2.3 创建 GlassCard 组件
    - 实现 default/strong/active/danger 变体
    - 实现 hoverable 属性
    - 实现 glowOnActive 属性
    - _Requirements: 1.2, 5.1_
  - [x] 2.4 创建 GlassButton 组件
    - 实现 primary/secondary/ghost 变体
    - 实现渐变样式
    - _Requirements: 3.4, 7.6_
  - [x] 2.5 创建 GlassInput 组件
    - 实现玻璃效果边框
    - 实现 focus 状态样式
    - _Requirements: 7.5_

- [x] 3. Checkpoint - 基础组件验证
  - 确保所有基础组件可正常渲染，ask the user if questions arise.

- [x] 4. 重构 Header 组件
  - [x] 4.1 更新 Header 样式
    - 应用渐变文字效果到标题
    - 应用玻璃效果到操作按钮
    - 添加入场动画
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. 创建 NavigationBar 组件
  - [x] 5.1 实现 Bento Grid 导航布局
    - 创建 NavigationBar 组件
    - 实现 CSS Grid 不规则布局
    - 应用玻璃效果到导航卡片
    - 实现图标渐变颜色
    - 实现 hover 缩放和发光效果
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 5.2 更新 App.tsx 使用 NavigationBar
    - 替换现有导航按钮组
    - 保持功能不变
    - _Requirements: 4.1_

- [x] 6. 重构 AccountCard 组件
  - [x] 6.1 应用 Glassmorphism 样式
    - 使用 GlassCard 作为容器
    - 实现活跃状态发光边框
    - 实现 hover 阴影提升效果
    - _Requirements: 5.1, 5.2, 5.5_
  - [x] 6.2 替换进度条为环形指示器
    - 使用 CircularProgress 替换线性进度条
    - 调整布局为左右分栏
    - _Requirements: 5.3, 6.1_
  - [x] 6.3 优化 Badge 和状态显示
    - Plan Badge 使用渐变背景
    - 最佳账号 Badge 添加脉冲动画
    - Token 过期状态使用 danger 样式
    - _Requirements: 5.4, 5.6, 5.7_
  - [x] 6.4 编写 AccountCard 属性测试
    - **Property 1: AccountCard State-Based Styling**
    - **Validates: Requirements 2.4, 5.2, 5.6, 5.7**

- [x] 7. Checkpoint - 主界面验证
  - 确保 Header、NavigationBar、AccountCard 正常工作，ask the user if questions arise.

- [x] 8. 重构 Dialog 组件
  - [x] 8.1 更新 AddAccountDialog 样式
    - 应用玻璃效果遮罩和容器
    - 使用 GlassInput 替换输入框
    - 使用 GlassButton 替换按钮
    - 添加 Framer Motion 入场/退场动画
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 8.2 更新 EditAccountDialog 样式
    - 应用相同的玻璃效果
    - _Requirements: 7.1, 7.4, 7.5, 7.6_
  - [x] 8.3 更新 SettingsDialog 样式
    - 应用玻璃效果
    - 优化表单布局
    - _Requirements: 7.1, 7.4, 7.5, 7.6_
  - [x] 8.4 更新 CodexSyncDialog 样式
    - 应用玻璃效果
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

- [x] 9. 重构 Panel 组件
  - [x] 9.1 更新 PromptsPanel 样式
    - 应用玻璃效果到容器
    - 优化列表项 hover 效果
    - 实现选中项高亮
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.2 更新 SkillsPanel 样式
    - 应用相同的玻璃效果
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.3 更新 AgentsPanel 样式
    - 应用相同的玻璃效果
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.4 更新 ConfigPanel 样式
    - 应用相同的玻璃效果
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 9.5 编写 Panel 选中高亮属性测试
    - **Property 3: Panel Selection Highlighting**
    - **Validates: Requirements 8.4**

- [x] 10. 优化空状态和动画
  - [x] 10.1 优化空状态设计
    - 更新空状态插画/图标
    - 应用玻璃效果容器
    - 添加入场动画
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 10.2 添加全局动画配置
    - 配置 Framer Motion 默认过渡
    - 实现交错入场动画
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. 响应式适配
  - [x] 11.1 优化小屏幕布局
    - NavigationBar 垂直堆叠
    - AccountCard 单列布局
    - Dialog 全屏适配
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 12. Final Checkpoint - 全量验证
  - 确保所有组件样式一致，动画流畅，响应式正常，ask the user if questions arise.

## Notes

- 所有任务均为必做
- 每个 Checkpoint 后建议运行 `npm run tauri dev` 进行视觉验证
- 属性测试使用 fast-check 库，需要先安装：`npm install -D fast-check @testing-library/react vitest jsdom`
- 优先保证功能不受影响，样式渐进增强
