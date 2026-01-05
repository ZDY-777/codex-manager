import { useState, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { useAccounts } from '../hooks/useAccounts';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

export function SettingsDialog({ isOpen, onClose, settings, onUpdateSettings }: SettingsDialogProps) {
    const { getAccountsDir, setAccountsDir, refresh } = useAccounts();
    const [localDir, setLocalDir] = useState<string>('');
    const [webdavTesting, setWebdavTesting] = useState(false);
    const [webdavSyncing, setWebdavSyncing] = useState(false);
    const [webdavMessage, setWebdavMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const webdav = settings.webdav || DEFAULT_SETTINGS.webdav!;

    useEffect(() => {
        if (isOpen) {
            getAccountsDir().then(setLocalDir);
            setWebdavMessage(null);
        }
    }, [isOpen, getAccountsDir]);

    if (!isOpen) return null;

    const handleSaveDir = async () => {
        if (localDir) {
            await setAccountsDir(localDir);
        }
    };

    const handleBrowseDir = async () => {
        const selected = await open({
            directory: true,
            multiple: false,
            defaultPath: localDir || undefined,
            title: '选择账号数据目录'
        });
        if (selected && typeof selected === 'string') {
            setLocalDir(selected);
            await setAccountsDir(selected);
        }
    };

    const updateWebdav = (updates: Partial<typeof webdav>) => {
        onUpdateSettings({
            webdav: { ...webdav, ...updates }
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
                }
            });
            setWebdavMessage({ type: 'success', text: result });
        } catch (e: any) {
            setWebdavMessage({ type: 'error', text: e.toString() });
        } finally {
            setWebdavTesting(false);
        }
    };

    const handleSyncUpload = async () => {
        setWebdavSyncing(true);
        setWebdavMessage(null);
        try {
            const result = await invoke<{ uploaded: string[], downloaded: string[], errors: string[] }>('webdav_sync_upload', {
                config: {
                    url: webdav.url,
                    username: webdav.username,
                    password: webdav.password,
                    remotePath: webdav.remotePath,
                }
            });
            if (result.errors.length > 0) {
                setWebdavMessage({ type: 'error', text: `上传完成，但有错误: ${result.errors.join(', ')}` });
            } else {
                setWebdavMessage({ type: 'success', text: `成功上传 ${result.uploaded.length} 个文件` });
            }
        } catch (e: any) {
            setWebdavMessage({ type: 'error', text: e.toString() });
        } finally {
            setWebdavSyncing(false);
        }
    };

    const handleSyncDownload = async () => {
        setWebdavSyncing(true);
        setWebdavMessage(null);
        try {
            const result = await invoke<{ uploaded: string[], downloaded: string[], errors: string[] }>('webdav_sync_download', {
                config: {
                    url: webdav.url,
                    username: webdav.username,
                    password: webdav.password,
                    remotePath: webdav.remotePath,
                }
            });
            if (result.errors.length > 0) {
                setWebdavMessage({ type: 'error', text: `下载完成，但有错误: ${result.errors.join(', ')}` });
            } else {
                setWebdavMessage({ type: 'success', text: `成功下载 ${result.downloaded.length} 个文件` });
            }
            await refresh();
        } catch (e: any) {
            setWebdavMessage({ type: 'error', text: e.toString() });
        } finally {
            setWebdavSyncing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">设置</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* 数据目录 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">账号数据目录</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={localDir}
                                onChange={(e) => setLocalDir(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary-500"
                            />
                            <button
                                onClick={handleBrowseDir}
                                className="btn bg-slate-700 hover:bg-slate-600 text-xs"
                                title="浏览文件夹"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </button>
                            <button
                                onClick={handleSaveDir}
                                className="btn bg-slate-700 hover:bg-slate-600 text-xs"
                            >
                                保存
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">
                            修改后会自动把现有 json 复制到新目录，原目录文件保留。
                        </p>
                    </div>

                    <div className="h-px bg-slate-700/50 my-4"></div>

                    {/* WebDAV 同步 */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-slate-200">☁️ 坚果云 WebDAV 同步</div>
                                <div className="text-xs text-slate-400">跨设备同步账号配置</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={webdav.enabled}
                                    onChange={(e) => updateWebdav({ enabled: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {webdav.enabled && (
                            <div className="space-y-3 pl-1">
                                {/* 配置说明 */}
                                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
                                    <p className="font-medium text-slate-300 mb-2">📋 配置步骤：</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>登录 <a href="https://www.jianguoyun.com" target="_blank" className="text-primary-400 hover:underline">坚果云官网</a></li>
                                        <li>点击右上角账户名 → 账户信息 → 安全选项</li>
                                        <li>找到"第三方应用管理" → 添加应用密码</li>
                                        <li>输入名称（如 codex-manager）→ 生成密码</li>
                                    </ol>
                                    <p className="mt-2 text-amber-400/80">⚠️ 密码是应用专用密码，不是登录密码！</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        服务器地址
                                    </label>
                                    <input
                                        type="text"
                                        value={webdav.url}
                                        onChange={(e) => updateWebdav({ url: e.target.value })}
                                        placeholder="https://dav.jianguoyun.com/dav/"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        用户名（坚果云登录邮箱）
                                    </label>
                                    <input
                                        type="text"
                                        value={webdav.username}
                                        onChange={(e) => updateWebdav({ username: e.target.value })}
                                        placeholder="your@email.com"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        应用密码（非登录密码）
                                    </label>
                                    <input
                                        type="password"
                                        value={webdav.password}
                                        onChange={(e) => updateWebdav({ password: e.target.value })}
                                        placeholder="在坚果云生成的应用专用密码"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">
                                        远程目录路径
                                    </label>
                                    <input
                                        type="text"
                                        value={webdav.remotePath}
                                        onChange={(e) => updateWebdav({ remotePath: e.target.value })}
                                        placeholder="/codex-manager/"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">坚果云中的存储路径，会自动创建</p>
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={webdavTesting || !webdav.username || !webdav.password}
                                        className="btn bg-slate-700 hover:bg-slate-600 text-xs flex-1"
                                    >
                                        {webdavTesting ? '测试中...' : '测试连接'}
                                    </button>
                                    <button
                                        onClick={handleSyncUpload}
                                        disabled={webdavSyncing || !webdav.username || !webdav.password}
                                        className="btn bg-blue-600 hover:bg-blue-500 text-xs flex-1"
                                    >
                                        {webdavSyncing ? '同步中...' : '↑ 上传'}
                                    </button>
                                    <button
                                        onClick={handleSyncDownload}
                                        disabled={webdavSyncing || !webdav.username || !webdav.password}
                                        className="btn bg-emerald-600 hover:bg-emerald-500 text-xs flex-1"
                                    >
                                        {webdavSyncing ? '同步中...' : '↓ 下载'}
                                    </button>
                                </div>

                                {/* 状态消息 */}
                                {webdavMessage && (
                                    <div className={`rounded-lg p-2 text-xs ${webdavMessage.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                                        {webdavMessage.text}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-slate-700/50 my-4"></div>

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
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                    </div>

                    {settings.autoCheck && (
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                检测间隔 (分钟)
                            </label>
                            <input
                                type="number"
                                min="5"
                                max="1440"
                                value={settings.checkInterval}
                                onChange={(e) => onUpdateSettings({ checkInterval: parseInt(e.target.value) || 30 })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
                            />
                        </div>
                    )}

                    <div className="h-px bg-slate-700/50 my-4"></div>

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
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {settings.enableAutoSwitch && (
                        <div className="pl-1 space-y-2">
                            <label className="block text-sm font-medium text-slate-400">
                                剩余额度低于 (%) 时自动切换
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={settings.autoSwitchThreshold}
                                onChange={(e) => {
                                    const val = Math.min(50, Math.max(1, parseInt(e.target.value) || settings.autoSwitchThreshold));
                                    onUpdateSettings({ autoSwitchThreshold: val });
                                }}
                                className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary-500 transition-colors"
                            />
                            <p className="text-xs text-slate-500">例如填 5，则剩余≤5% 时切到下一账号。</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
