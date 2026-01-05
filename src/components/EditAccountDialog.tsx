import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AccountInfo } from '../types';

interface EditAccountDialogProps {
    isOpen: boolean;
    onClose: () => void;
    account: AccountInfo | null;
    onSave: () => void;
}

export function EditAccountDialog({ isOpen, onClose, account, onSave }: EditAccountDialogProps) {
    const [jsonContent, setJsonContent] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingContent, setLoadingContent] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen && account) {
            loadContent();
        }
    }, [isOpen, account]);

    const loadContent = async () => {
        if (!account) return;
        setLoadingContent(true);
        setError('');
        try {
            const content = await invoke<string>('read_account_content', { filePath: account.filePath });
            setJsonContent(content);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoadingContent(false);
        }
    };

    if (!isOpen || !account) return null;

    const handleSave = async () => {
        if (!jsonContent.trim()) {
            setError('内容不能为空');
            return;
        }

        try {
            JSON.parse(jsonContent);
        } catch {
            setError('无效的 JSON 格式');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await invoke('update_account_content', { filePath: account.filePath, content: jsonContent });
            onSave();
            onClose();
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(jsonContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('复制失败');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">
                        编辑账号 - {account.name}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* JSON 内容 */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-400">
                                auth.json 内容
                            </label>
                            <button
                                onClick={handleCopy}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                            >
                                {copied ? (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        已复制
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        复制
                                    </>
                                )}
                            </button>
                        </div>
                        {loadingContent ? (
                            <div className="w-full h-[240px] bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center">
                                <svg className="animate-spin h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        ) : (
                            <textarea
                                value={jsonContent}
                                onChange={(e) => setJsonContent(e.target.value)}
                                rows={10}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-primary-500 transition-colors resize-none"
                            />
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start gap-2">
                            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm text-red-200">{error}</span>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="btn bg-slate-700 hover:bg-slate-600 text-white"
                        disabled={loading}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || loadingContent || !jsonContent.trim()}
                        className="btn btn-primary min-w-[100px] flex justify-center items-center gap-2"
                    >
                        {loading && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {loading ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    );
}
