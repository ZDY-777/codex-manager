import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSettings, DEFAULT_SETTINGS, DEFAULT_SYNC_SETTINGS } from '../types';
import { useAccounts } from '../hooks/useAccounts';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { GlassButton } from './ui';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

const dialogVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.1 } },
};

type SettingsTab = 'general' | 'sync';

export function SettingsDialog({ isOpen, onClose, settings, onUpdateSettings }: SettingsDialogProps) {
  const { getAccountsDir, setAccountsDir } = useAccounts();
  const [localDir, setLocalDir] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [webdavTesting, setWebdavTesting] = useState(false);
  const [webdavMessage, setWebdavMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showWebdavPassword, setShowWebdavPassword] = useState(false);

  const webdav = settings.webdav || DEFAULT_SETTINGS.webdav!;
  const sync = settings.sync || DEFAULT_SYNC_SETTINGS;

  useEffect(() => {
    if (isOpen) {
      getAccountsDir().then(setLocalDir);
      setWebdavMessage(null);
    }
  }, [isOpen, getAccountsDir]);

  const handleSaveDir = async () => {
    if (localDir) await setAccountsDir(localDir);
  };

  const handleBrowseDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: localDir || undefined,
      title: '选择账号数据目录',
    });
    if (selected && typeof selected === 'string') {
      setLocalDir(selected);
      await setAccountsDir(selected);
    }
  };

  const updateWebdav = (updates: Partial<typeof webdav>) => {
    onUpdateSettings({
      webdav: { ...webdav, ...updates },
    });
  };

  const updateSync = (updates: Partial<typeof sync>) => {
    onUpdateSettings({
      sync: { ...sync, ...updates },
    });
  };

  const handleTestConnection = async () => {
    setWebdavTesting(true);
    setWebdavMessage(null);
    try {
      const result = await invoke<string>('webdav_test_connection', {
        config: {
          url: webdav.url,
          username: webdav.username,
          password: webdav.password,
          remotePath: webdav.remotePath,
        },
      });
      setWebdavMessage({ type: 'success', text: result });
    } catch (e: unknown) {
      setWebdavMessage({ type: 'error', text: String(e) });
    } finally {
      setWebdavTesting(false);
    }
  };

  const formatLastSyncTime = (timestamp?: number) => {
    if (!timestamp) return '从未同步';
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            variants={overlayVariants}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative glass-strong w-full max-w-lg p-6 mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            variants={dialogVariants}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gradient">设置</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'general'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                常规
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'sync'
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                云同步
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* 数据目录 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">账号数据目录</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localDir}
                      onChange={(e) => setLocalDir(e.target.value)}
                      className="input-glass flex-1 text-sm"
                    />
                    <GlassButton variant="secondary" size="sm" onClick={handleBrowseDir}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </GlassButton>
                    <GlassButton variant="secondary" size="sm" onClick={handleSaveDir}>
                      保存
                    </GlassButton>
                  </div>
                  <p className="text-xs text-slate-500">修改后会自动把现有 json 复制到新目录</p>
                </div>

                <div className="h-px bg-white/10" />

                {/* 自动检测 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">自动后台检测</div>
                    <div className="text-xs text-slate-400">定期扫描账号状态和用量</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.autoCheck}
                      onChange={(e) => onUpdateSettings({ autoCheck: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                  </label>
                </div>

                {settings.autoCheck && (
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">检测间隔 (分钟)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={settings.checkInterval}
                      onChange={(e) => onUpdateSettings({ checkInterval: parseInt(e.target.value) || 30 })}
                      className="input-glass w-32"
                    />
                  </div>
                )}

                <div className="h-px bg-white/10" />

                {/* 智能调度 */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-200">智能自动切换</div>
                    <div className="text-xs text-slate-400">按剩余额度阈值自动切到最佳备选账号</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.enableAutoSwitch}
                      onChange={(e) => onUpdateSettings({ enableAutoSwitch: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                {settings.enableAutoSwitch && (
                  <div className="pl-1 space-y-2">
                    <label className="block text-sm font-medium text-slate-400">剩余额度低于 (%) 时自动切换</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settings.autoSwitchThreshold}
                      onChange={(e) => {
                        const val = Math.min(50, Math.max(1, parseInt(e.target.value) || settings.autoSwitchThreshold));
                        onUpdateSettings({ autoSwitchThreshold: val });
                      }}
                      className="input-glass w-32"
                    />
                    <p className="text-xs text-slate-500">例如填 5，则剩余≤5% 时切到下一账号</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sync' && (
              <div className="space-y-6">
                {/* 快捷操作 */}
                <div className="flex gap-2">
                  <GlassButton
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await invoke('open_codex_dir');
                      } catch (e) {
                        console.error('打开目录失败:', e);
                      }
                    }}
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    }
                  >
                    打开 .codex 目录
                  </GlassButton>
                </div>

                {/* WebDAV 配置 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">☁️ WebDAV 云同步</div>
                      <div className="text-xs text-slate-400">跨设备同步账号和配置</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={webdav.enabled}
                        onChange={(e) => updateWebdav({ enabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>

                  {webdav.enabled && (
                    <div className="space-y-3 pl-1">
                      {/* 配置说明 */}
                      <div className="glass-light p-3 text-xs text-slate-400">
                        <p className="font-medium text-slate-300 mb-2">📋 坚果云配置步骤：</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>登录 <a href="https://www.jianguoyun.com" target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">坚果云官网</a></li>
                          <li>账户信息 → 安全选项 → 第三方应用管理</li>
                          <li>添加应用密码 → 生成密码</li>
                        </ol>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">服务器地址</label>
                        <input
                          type="text"
                          value={webdav.url}
                          onChange={(e) => updateWebdav({ url: e.target.value })}
                          placeholder="https://dav.jianguoyun.com/dav/"
                          className="input-glass text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">用户名</label>
                        <input
                          type="text"
                          value={webdav.username}
                          onChange={(e) => updateWebdav({ username: e.target.value })}
                          placeholder="your@email.com"
                          className="input-glass text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">应用密码</label>
                        <div className="flex gap-2">
                          <input
                            type={showWebdavPassword ? 'text' : 'password'}
                            value={webdav.password}
                            onChange={(e) => updateWebdav({ password: e.target.value })}
                            placeholder="应用专用密码"
                            className="input-glass text-sm flex-1"
                          />
                          <GlassButton variant="secondary" size="sm" onClick={() => setShowWebdavPassword((v) => !v)}>
                            {showWebdavPassword ? '隐藏' : '显示'}
                          </GlassButton>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">远程目录</label>
                        <input
                          type="text"
                          value={webdav.remotePath}
                          onChange={(e) => updateWebdav({ remotePath: e.target.value })}
                          placeholder="/codex-manager/"
                          className="input-glass text-sm"
                        />
                      </div>

                      <GlassButton
                        variant="secondary"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={webdavTesting || !webdav.username || !webdav.password}
                        loading={webdavTesting}
                      >
                        测试连接
                      </GlassButton>

                      {webdavMessage && (
                        <div
                          className={`rounded-xl p-3 text-xs ${
                            webdavMessage.type === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {webdavMessage.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {webdav.enabled && (
                  <>
                    <div className="h-px bg-white/10" />

                    {/* 同步内容 */}
                    <div className="space-y-3">
                      <div className="font-medium text-slate-200">同步内容</div>
                      
                      <label className="flex items-center gap-3 p-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={sync.syncAccounts}
                          onChange={(e) => updateSync({ syncAccounts: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white">账号文件</div>
                          <div className="text-xs text-slate-400">auth.json 认证文件</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={sync.syncPrompts}
                          onChange={(e) => updateSync({ syncPrompts: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white">Prompts</div>
                          <div className="text-xs text-slate-400">~/.codex/prompts/</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={sync.syncSkills}
                          onChange={(e) => updateSync({ syncSkills: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white">Skills</div>
                          <div className="text-xs text-slate-400">~/.codex/skills/</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={sync.syncAgentsMd}
                          onChange={(e) => updateSync({ syncAgentsMd: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white">AGENTS.MD</div>
                          <div className="text-xs text-slate-400">系统提示词</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2 glass-light rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={sync.syncConfigToml}
                          onChange={(e) => updateSync({ syncConfigToml: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 bg-slate-700"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-white flex items-center gap-2">
                            config.toml
                            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">谨慎</span>
                          </div>
                          <div className="text-xs text-slate-400">MCP 路径可能因设备而异</div>
                        </div>
                      </label>
                    </div>

                    {/* 上次同步时间 */}
                    <div className="glass-light p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">上次同步</span>
                        <span className="text-xs text-slate-300">{formatLastSyncTime(sync.lastSyncTime)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
