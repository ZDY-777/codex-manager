# Codex Manager

Codex Manager 是一个基于 **Tauri + React + Rust** 构建的 OpenAI 账号管理与切换工具。它可以帮助你安全地管理多个 ChatGPT 账号 (`auth.json`)，实时监控用量，并在账号耗尽时自动切换，方便 team 账号额度切换。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

## ✨主要功能

*   **🛡️ 安全管理**：本地化存储 `auth.json` 凭证，不上传任何敏感数据。
*   **📊 实时监控**：
    *   直观展示 **5小时限制 (5-Hour Limit)** 和 **每周限制 (Weekly Limit)** 的剩余百分比。
    *   精准显示重置倒计时 (e.g., "2小时后重置")。
*   **⚡ 智能调度 (Smart Scheduling)**：
    *   **自动切换**：当当前账号 Token 过期或剩余额度低于自定义阈值时，后台自动检测并切换到最佳备选账号。
    *   **可调阈值**：剩余百分比 1%~50% 可配置，默认 5%。
*   **➕ 快捷添加**：支持直接粘贴 `auth.json` 内容添加账号，自动提取邮箱作为文件名。
*   **📝 Codex 配置管理**：
    *   管理 Prompts（`~/.codex/prompts/`）
    *   管理 Skills（`~/.codex/skills/`）
    *   编辑 AGENTS.MD 系统提示词
    *   编辑 config.toml 配置文件
*   **☁️ WebDAV 云同步**：
    *   账号配置同步到坚果云，多设备共享
    *   Codex 配置同步（Prompts、Skills、AGENTS.MD、config.toml 可选）


## 📸 界面预览

<!-- TODO: 更新截图 -->
![Codex Manager Dashboard](src/assets/preview.jpg)
## 🚀 快速开始

### 安装

目前提供 Windows 版本构建。

1.  下载最新 Release 的安装包 (`.msi` 或 `.exe`)。
2.  运行安装程序完成安装。

### 开发环境运行

如果你想自己编译：

```bash
# 1. 克隆项目
git clone https://github.com/ZDY-777/codex-manager.git
cd switch/myswitch

# 2. 安装依赖
npm install
# 确保你已经安装了 Rust 环境 (cargo)

# 3. 启动开发模式
npm run tauri dev
```

## 📖 使用指南

### 1. 添加账号
*   点击顶部导航栏的 **"+ 添加"** 按钮。
*   粘贴你的 `auth.json` 内容（通常包含 `access_token`, `refresh_token` 等）。
*   (可选) 输入账号别名。点击保存。

### 2. 手动切换
*   在账号列表中，找到状态为“有效”的账号。
*   点击卡片右侧的 **"切换账号"** 按钮。
*   应用会自动将该账号的凭证应用到系统全局配置 (`~/.codex/auth.json` 或目标路径)。

### 3. 设置智能调度
*   点击顶部 **"设置"** 图标。
*   开启 **"自动后台检测"** (推荐 30分钟间隔)。
*   开启 **"智能自动切换"**，并设置剩余百分比阈值（默认 5%）。
*   此后，只要保持软件开启，它将在后台自动维护账号高可用。
*  需重启codex对话。

## 🛠️ 技术栈

*   **Frontend**: React, TypeScript, TailwindCSS, Vite
*   **Backend**: Rust, Tauri
*   **State Management**: React Hooks
*   **Charts/UI**: Custom CSS Components

## 📂 目录结构

*   `src/`: 前端 React 代码
*   `src-tauri/`: 后端 Rust 代码
*   `src-tauri/src/lib.rs`: 核心业务逻辑 (文件操作, API 请求)

## 📄 License

MIT License

## 🤝 开源与贡献

- 行为准则：见 `CODE_OF_CONDUCT.md`
- 贡献指南：见 `CONTRIBUTING.md`
- Issue/PR：请使用 `.github/ISSUE_TEMPLATE/*` 与 `.github/pull_request_template.md`
