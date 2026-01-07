import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { WebDavConfig, CodexSyncConfig, DEFAULT_CODEX_SYNC_CONFIG, SyncResult } from '../types';

interface CodexSyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  webdavConfig: WebDavConfig;
}

export function CodexSyncDialog({ isOpen, onClose, webdavConfig }: CodexSyncDialogProps) {
  const [syncConfig, setSyncConfig] = useState<CodexSyncConfig>(DEFAULT_CODEX_SYNC_CONFIG);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncDirection, setSyncDirection] = useState<'upload' | 'download' | null>(null);

  if (!isOpen) return null;

  const handleSync = async (direction: 'upload' | 'download') => {
    if (!webdavConfig.enabled || !webdavConfig.url || !webdavConfig.username) {
      alert('请先在设置中配置 WebDAV');
      return;
    }

    setSyncing(true);
    setSyncDirection(direction);
    setSyncResult(null);

    try {
      const config = {
        url: webdavConfig.url,
        username: webdavConfig.username,
        password: webdavConfig.password,
        remotePath: webdavConfig.remotePath,
      };

      const result = await invoke<SyncResult>(
        direction === 'upload' ? 'webdav_sync_codex_upload' : 'webdav_sync_codex_download',
        { config, syncConfig }
      );
      setSyncResult(result);
    } catch (error) {
      setSyncResult({
        uploaded: [],
        downloaded: [],
        errors: [String(error)],
      });
    } finally {
      setSyncing(false);
      setSyncDirection(null);
    }
  };

  const openCodexDir = async () => {
    try {
      await invoke('open_codex_dir');
    } catch (error) {
      console.error('打开目录失败:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 border border-slate-700 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Codex 配置同步</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* WebDAV 状态 */}
        <div className={`p-3 rounded-lg mb-4 ${webdavConfig.enabled ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${webdavConfig.enabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className={`text-sm ${webdavConfig.enabled ? 'text-green-400' : 'text-yellow-400'}`}>
              {webdavConfig.enabled ? `WebDAV 已配置: ${webdavConfig.url}` : 'WebDAV 未配置，请先在设置中配置'}
            </span>
          </div>
        </div>

        {/* 同步选项 */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-slate-300">同步内容</h4>
          
          <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
            <input
              type="checkbox"
              checked={syncConfig.syncPrompts}
              onChange={(e) => setSyncConfig({ ...syncConfig, syncPrompts: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
            />
            <div className="flex-1">
              <div className="text-white">Prompts</div>
              <div className="text-xs text-slate-400">~/.codex/prompts/ 目录下的所有 prompt 文件</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
            <input
              type="checkbox"
              checked={syncConfig.syncSkills}
              onChange={(e) => setSyncConfig({ ...syncConfig, syncSkills: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
            />
            <div className="flex-1">
              <div className="text-white">Skills</div>
              <div className="text-xs text-slate-400">~/.codex/skills/ 目录下的所有 skill（含 scripts、assets）</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
            <input
              type="checkbox"
              checked={syncConfig.syncAgentsMd}
              onChange={(e) => setSyncConfig({ ...syncConfig, syncAgentsMd: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
            />
            <div className="flex-1">
              <div className="text-white">AGENTS.MD</div>
              <div className="text-xs text-slate-400">系统提示词配置文件</div>
            </div>
          </label>

          {/* config.toml 分组选项 */}
          <div className="border-t border-slate-700 pt-3 mt-3">
            <h4 className="text-sm font-medium text-slate-300 mb-3">config.toml 设置</h4>
            
            <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors">
              <input
                type="checkbox"
                checked={syncConfig.syncModelConfig}
                onChange={(e) => setSyncConfig({ ...syncConfig, syncModelConfig: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
              />
              <div className="flex-1">
                <div className="text-white">模型配置</div>
                <div className="text-xs text-slate-400">model, model_reasoning_effort 等</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors mt-2">
              <input
                type="checkbox"
                checked={syncConfig.syncMcpServers}
                onChange={(e) => setSyncConfig({ ...syncConfig, syncMcpServers: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
              />
              <div className="flex-1">
                <div className="text-white flex items-center gap-2">
                  MCP 服务器配置
                  <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">谨慎</span>
                </div>
                <div className="text-xs text-slate-400">mcp_servers.* - 路径可能因设备而异</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900/70 transition-colors mt-2">
              <input
                type="checkbox"
                checked={syncConfig.syncOtherConfig}
                onChange={(e) => setSyncConfig({ ...syncConfig, syncOtherConfig: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
              />
              <div className="flex-1">
                <div className="text-white">其他配置</div>
                <div className="text-xs text-slate-400">notice.* 等其他设置</div>
              </div>
            </label>
          </div>
        </div>

        {/* 同步按钮 */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleSync('upload')}
            disabled={syncing || !webdavConfig.enabled}
            className="flex-1 btn btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing && syncDirection === 'upload' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
            上传到云端
          </button>
          <button
            onClick={() => handleSync('download')}
            disabled={syncing || !webdavConfig.enabled}
            className="flex-1 btn bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing && syncDirection === 'download' ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            )}
            从云端下载
          </button>
        </div>

        {/* 同步结果 */}
        {syncResult && (
          <div className="space-y-2 p-3 bg-slate-900/50 rounded-lg">
            {syncResult.uploaded.length > 0 && (
              <div>
                <div className="text-xs text-green-400 mb-1">已上传 ({syncResult.uploaded.length})</div>
                <div className="text-xs text-slate-400 max-h-20 overflow-y-auto">
                  {syncResult.uploaded.slice(0, 10).join(', ')}
                  {syncResult.uploaded.length > 10 && ` ... 等 ${syncResult.uploaded.length} 个文件`}
                </div>
              </div>
            )}
            {syncResult.downloaded.length > 0 && (
              <div>
                <div className="text-xs text-blue-400 mb-1">已下载 ({syncResult.downloaded.length})</div>
                <div className="text-xs text-slate-400 max-h-20 overflow-y-auto">
                  {syncResult.downloaded.slice(0, 10).join(', ')}
                  {syncResult.downloaded.length > 10 && ` ... 等 ${syncResult.downloaded.length} 个文件`}
                </div>
              </div>
            )}
            {syncResult.errors.length > 0 && (
              <div>
                <div className="text-xs text-red-400 mb-1">错误 ({syncResult.errors.length})</div>
                <div className="text-xs text-red-300 max-h-20 overflow-y-auto">
                  {syncResult.errors.join('\n')}
                </div>
              </div>
            )}
            {syncResult.uploaded.length === 0 && syncResult.downloaded.length === 0 && syncResult.errors.length === 0 && (
              <div className="text-xs text-slate-400">没有需要同步的内容</div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
          <button
            onClick={openCodexDir}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            打开 .codex 目录
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            关闭
          </button>
        </div>
      </motion.div>
    </div>
  );
}
