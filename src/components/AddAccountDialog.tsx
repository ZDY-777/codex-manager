import { useState } from 'react';
import { useAccounts } from '../hooks/useAccounts';

interface AddAccountDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddAccountDialog({ isOpen, onClose }: AddAccountDialogProps) {
    const { addAccount } = useAccounts();
    const [name, setName] = useState('');
    const [jsonContent, setJsonContent] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!jsonContent.trim()) {
            setError('请粘贴 auth.json 内容');
            return;
        }

        try {
            // 基本的 JSON 验证
            JSON.parse(jsonContent);
        } catch {
            setError('无效的 JSON 格式');
            return;
        }

        setLoading(true);
        setError('');

        const result = await addAccount(name, jsonContent);
        if (result.success) {
            onClose();
            // 重置表单
            setName('');
            setJsonContent('');
        } else {
            setError(result.message || '添加失败');
        }
        setLoading(false);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setJsonContent(text);
                setError('');
            }
        } catch (e) {
            setError('无法读取剪贴板');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">
                        添加账号
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* 名称输入 (可选) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">
                            账号名称 (可选)
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="如果不填，将自动从 Token 提取邮箱"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 transition-colors"
                        />
                    </div>

                    {/* JSON 内容 */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-400">
                                auth.json 内容
                            </label>
                            <button
                                onClick={handlePaste}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                粘贴剪贴板
                            </button>
                        </div>
                        <textarea
                            value={jsonContent}
                            onChange={(e) => setJsonContent(e.target.value)}
                            rows={8}
                            placeholder='{"openai_api_key": null, "tokens": {...}}'
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-primary-500 transition-colors resize-none"
                        />
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
                        disabled={loading || !jsonContent.trim()}
                        className="btn btn-primary min-w-[100px] flex justify-center items-center gap-2"
                    >
                        {loading && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {loading ? '保存中...' : '添加'}
                    </button>
                </div>
            </div>
        </div>
    );
}
