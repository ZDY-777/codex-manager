# Design Document: UI/UX Overhaul

## Overview

本设计文档描述 Codex Manager 应用的全量 UI/UX 优化方案。采用 Glassmorphism（毛玻璃）风格作为核心视觉语言，结合 Bento Grid 布局优化导航体验，并引入环形进度指示器提升数据可视化效果。

技术栈：React + TypeScript + TailwindCSS + Framer Motion

## Architecture

### 设计系统层次

```
┌─────────────────────────────────────────────────────────┐
│                    Design Tokens                         │
│  (Colors, Spacing, Typography, Shadows, Animations)     │
├─────────────────────────────────────────────────────────┤
│                   Utility Classes                        │
│  (Glassmorphism, Gradients, Glow Effects)               │
├─────────────────────────────────────────────────────────┤
│                  Base Components                         │
│  (GlassCard, GlassButton, CircularProgress, GlassInput) │
├─────────────────────────────────────────────────────────┤
│                 Feature Components                       │
│  (AccountCard, Header, NavigationBar, Dialog, Panel)    │
└─────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/
├── index.css              # 全局样式 + Glassmorphism 工具类
├── components/
│   ├── ui/                # 新增：基础 UI 组件
│   │   ├── GlassCard.tsx
│   │   ├── GlassButton.tsx
│   │   ├── CircularProgress.tsx
│   │   └── GlassInput.tsx
│   ├── AccountCard.tsx    # 重构
│   ├── Header.tsx         # 重构
│   ├── NavigationBar.tsx  # 新增：Bento Grid 导航
│   ├── AddAccountDialog.tsx # 重构
│   ├── SettingsDialog.tsx   # 重构
│   └── ...Panel.tsx       # 重构
└── App.tsx                # 重构
tailwind.config.js         # 扩展配色和动画
```

## Components and Interfaces

### 1. Design Tokens (tailwind.config.js)

```typescript
// 扩展 Tailwind 配置
{
  theme: {
    extend: {
      colors: {
        // 主色调：青色/蓝绿色
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // 玻璃效果专用
        glass: {
          white: 'rgba(255, 255, 255, 0.1)',
          border: 'rgba(255, 255, 255, 0.15)',
          hover: 'rgba(255, 255, 255, 0.2)',
        }
      },
      backdropBlur: {
        xs: '2px',
        glass: '12px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-strong': '0 0 30px rgba(6, 182, 212, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      }
    }
  }
}
```

### 2. Glassmorphism Utility Classes (index.css)

```css
@layer components {
  /* 基础玻璃卡片 */
  .glass {
    @apply bg-white/10 backdrop-blur-glass border border-white/15 rounded-2xl;
  }
  
  .glass-hover {
    @apply hover:bg-white/15 hover:border-white/20 hover:shadow-glass-hover;
  }
  
  /* 强调玻璃效果 */
  .glass-strong {
    @apply bg-white/15 backdrop-blur-xl border border-white/20;
  }
  
  /* 发光边框 */
  .glow-border {
    @apply border-primary-500/50 shadow-glow;
  }
  
  .glow-border-strong {
    @apply border-primary-400/60 shadow-glow-strong;
  }
  
  /* 渐变文字 */
  .text-gradient {
    @apply bg-gradient-to-r from-white via-primary-200 to-primary-400 bg-clip-text text-transparent;
  }
  
  /* 渐变按钮 */
  .btn-gradient {
    @apply bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400;
  }
}
```

### 3. CircularProgress Component

```typescript
interface CircularProgressProps {
  value: number;           // 0-100
  size?: number;           // 默认 80
  strokeWidth?: number;    // 默认 8
  label?: string;          // 标签文字
  showPercentage?: boolean; // 显示百分比
}

// 颜色映射逻辑
function getProgressColor(value: number): string {
  const remaining = 100 - value;
  if (remaining <= 10) return 'stroke-rose-500';
  if (remaining <= 30) return 'stroke-amber-500';
  return 'stroke-emerald-500';
}

// SVG 实现
// - 背景圆环：stroke-slate-700/50
// - 进度圆环：渐变色 + 发光效果
// - 中心文字：百分比 + 标签
```

### 4. GlassCard Component

```typescript
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'strong' | 'active';
  hoverable?: boolean;
  glowOnActive?: boolean;
}

// 变体样式映射
const variants = {
  default: 'glass',
  strong: 'glass-strong',
  active: 'glass glow-border',
};
```

### 5. NavigationBar (Bento Grid)

```typescript
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;        // 图标颜色类
  size?: 'normal' | 'large'; // Bento 尺寸
}

// Bento Grid 布局
// - 使用 CSS Grid 实现不规则布局
// - 主要入口（Prompts）占据更大空间
// - 其他入口均匀分布
```

### 6. AccountCard 重构

```typescript
// 主要变更：
// 1. 应用 GlassCard 作为容器
// 2. 替换线性进度条为 CircularProgress
// 3. 活跃状态添加发光边框
// 4. Plan Badge 使用渐变背景
// 5. 优化信息布局为左右分栏

// 布局结构：
// ┌─────────────────────────────────────────┐
// │ [状态点] 账号名称 [Plan Badge] [最佳]   │
// │                              [切换按钮] │
// ├─────────────────────────────────────────┤
// │ 📧 邮箱          │  ┌──────┐ ┌──────┐  │
// │ 🕐 更新时间      │  │ 5小时 │ │ 每周  │  │
// │ 📅 有效期        │  │  环形 │ │ 环形  │  │
// │                  │  └──────┘ └──────┘  │
// └─────────────────────────────────────────┘
```

### 7. Dialog 重构

```typescript
// 主要变更：
// 1. 遮罩层使用 backdrop-blur
// 2. 弹窗容器使用 glass-strong
// 3. 入场/退场动画使用 Framer Motion
// 4. 表单输入框使用玻璃效果
// 5. 按钮使用渐变样式

// Framer Motion 配置
const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 }
};
```

## Data Models

本次优化主要涉及 UI 层，不涉及数据模型变更。现有的 `AccountInfo`、`AppSettings` 等类型保持不变。

### 新增类型定义

```typescript
// 进度指示器颜色状态
type ProgressColorState = 'success' | 'warning' | 'danger';

// 导航项配置
interface NavigationItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  gridArea?: string; // Bento Grid 区域
}

// 玻璃卡片变体
type GlassVariant = 'default' | 'strong' | 'active' | 'danger';
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: AccountCard State-Based Styling

*For any* AccountCard component with given account state (isActive, isBestCandidate, isTokenExpired), the component SHALL apply the correct combination of CSS classes:
- If isActive is true, the card SHALL have glow-border class
- If isBestCandidate is true and isActive is false, the badge SHALL have pulse animation class
- If isTokenExpired is true, the card SHALL have danger variant styling

**Validates: Requirements 2.4, 5.2, 5.6, 5.7**

### Property 2: ProgressIndicator Value and Color Mapping

*For any* CircularProgress component with a value between 0 and 100:
- The displayed percentage text SHALL equal (100 - value) rounded to nearest integer
- If remaining (100 - value) <= 10, the stroke color SHALL be rose/red
- If remaining > 10 and <= 30, the stroke color SHALL be amber/yellow
- If remaining > 30, the stroke color SHALL be emerald/green

**Validates: Requirements 6.2, 6.3**

### Property 3: Panel Selection Highlighting

*For any* Panel component with a list of items and a selectedId:
- The item with id matching selectedId SHALL have the accent glow highlight class
- All other items SHALL NOT have the accent glow highlight class

**Validates: Requirements 8.4**

## Error Handling

### 样式降级策略

1. **backdrop-filter 不支持**：提供 fallback 背景色
```css
.glass {
  background: rgba(30, 41, 59, 0.8); /* fallback */
  @supports (backdrop-filter: blur(12px)) {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
  }
}
```

2. **动画性能问题**：尊重 reduced-motion 偏好
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

3. **渐变不支持**：提供纯色 fallback
```css
.btn-gradient {
  background: #0891b2; /* fallback */
  background: linear-gradient(to right, #0891b2, #06b6d4);
}
```

## Testing Strategy

### 单元测试

使用 Vitest + React Testing Library 进行组件测试：

1. **CircularProgress 组件**
   - 测试不同 value 值的颜色映射
   - 测试百分比文字显示正确性
   - 测试 SVG 元素渲染

2. **AccountCard 组件**
   - 测试不同状态下的 CSS 类应用
   - 测试 Plan Badge 渲染
   - 测试交互回调

3. **GlassCard 组件**
   - 测试不同 variant 的样式类
   - 测试 hoverable 属性

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1**: 生成随机 account 状态组合，验证样式类正确应用
2. **Property 2**: 生成 0-100 随机值，验证颜色映射和百分比显示
3. **Property 3**: 生成随机 item 列表和 selectedId，验证高亮逻辑

### 视觉回归测试

建议使用 Storybook + Chromatic 进行视觉回归测试（可选）。

### 测试配置

```typescript
// vitest.config.ts
export default {
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  }
}

// 属性测试最少运行 100 次迭代
// fast-check 配置
fc.configureGlobal({ numRuns: 100 });
```
