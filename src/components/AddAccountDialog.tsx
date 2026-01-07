import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccounts } from '../hooks/useAccounts';
import { GlassCard, GlassButton, GlassInput, GlassTextarea } from './ui';

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

export function AddAccountDialog({ isOpen, onClose }: AddAccountDialogProps) {
  const { addAccount } = useAccounts();
  const [name, setName] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!jsonContent.trim()) {
      setError('请粘贴 auth.json 内容');
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
    const result = await addAccount(name, jsonContent);
    if (result.success) {
      onClose();
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
    } catch {
      setError('无法读取剪贴板');
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setError('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial="hidden" animate="visible" exit="hidden">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" variants={overlayVariants} onClick={handleClose} />
          <motion.div variants={dialogVariants} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative w-full max-w-lg">
            <GlassCard variant="strong" padding="lg">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gradient">添加账号</h3>
                <button onClick={handleClose} className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <GlassInput label="账号名称 (可选)" value={name} onChange={(e) => setName(e.target.value)} placeholder="如果不填，将自动从 Token 提取邮箱" />
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-medium text-slate-400">auth.json 内容</label>
                    <button onClick={handlePaste} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      粘贴剪贴板
                    </button>
                  </div>
                  <GlassTextarea value={jsonContent} onChange={(e) => setJsonContent(e.target.value)} rows={8} placeholder='{"openai_api_key": null, "tokens": {...}}' className="font-mono text-xs" />
                </div>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-light p-3 flex items-start gap-2 border-rose-500/30">
                    <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-rose-300">{error}</span>
                  </motion.div>
                )}
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <GlassButton variant="secondary" onClick={handleClose} disabled={loading}>取消</GlassButton>
                <GlassButton variant="primary" onClick={handleSave} disabled={loading || !jsonContent.trim()} loading={loading}>{loading ? '保存中...' : '添加'}</GlassButton>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
