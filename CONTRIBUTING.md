# Contributing to Codex Manager

感谢关注 Codex Manager！请遵循以下约定以保持协作顺畅。

## 开发环境
- Node 18+，Rust 工具链（用于 Tauri）
- 安装依赖：`npm install`
- 开发调试：`npm run tauri dev`
- 生产构建：`npm run tauri build`

## 分支与提交
- 主分支保持可发布状态，功能/修复请使用 `feature/*` 或 `fix/*` 分支。
- 提交信息推荐格式：`type: short summary`（如 `fix: handle token refresh error`）。

## 代码风格
- 前端：TypeScript + React + TailwindCSS，保持现有 class 命名与浅层组件结构。
- Rust：遵循 `rustfmt` 默认格式与 `clippy` 建议。
- 仅在复杂逻辑处添加简短注释，保持 KISS/YAGNI。

## 测试与检查
- 提交前至少运行：`npm run build`（确保前端通过），如有 Rust 逻辑可补充 `cargo clippy`。
- 若改动核心逻辑，请添加或更新相应的单元/集成测试（前端或 Rust）。

## 提 PR 前检查
- 填写 PR 模板，描述变更、测试结果、风险与回滚方案。
- 确认未包含任何密钥/私有数据，`auth.json` 示例必须为假数据。

## Issue 提交
- Bug：提供复现步骤、期望/实际结果、日志或截图。
- 功能请求：说明场景、动机和期望行为。

## 行为准则
参与即表示同意遵守 `CODE_OF_CONDUCT.md`。
