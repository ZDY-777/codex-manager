import { useState } from 'react';
import { Header } from './components/Header';
import { AccountCard } from './components/AccountCard';
import { AddAccountDialog } from './components/AddAccountDialog';
import { EditAccountDialog } from './components/EditAccountDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { PromptsPanel } from './components/PromptsPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { CodexSyncDialog } from './components/CodexSyncDialog';
import { useAccounts } from './hooks/useAccounts';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountInfo } from './types';

type ViewType = 'accounts' | 'prompts' | 'skills';

function App() {
  const {
    accounts,
    loading,
    refresh,
    switchAccount,
    settings,
    updateSettings,
    renameAccount,
    bestCandidateId
  } = useAccounts();

  const [currentView, setCurrentView] = useState<ViewType>('accounts');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCodexSyncOpen, setIsCodexSyncOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountInfo | null>(null);

  const handleOpenDir = async () => {
    try {
      await invoke('open_accounts_dir');
    } catch (error) {
      console.error('无法打开目录:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6 font-sans selection:bg-primary-500/30">
      <div className="max-w-2xl mx-auto">
        {/* 导航标签 */}
        {currentView === 'accounts' && (
          <>
            <Header
              onRefresh={refresh}
              onOpenDir={handleOpenDir}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onAddAccount={() => setIsAddDialogOpen(true)}
              loading={loading}
            />
            
            {/* Codex 管理入口 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCurrentView('prompts')}
                className="flex-1 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-slate-300">Prompts</span>
              </button>
              <button
                onClick={() => setCurrentView('skills')}
                className="flex-1 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span className="text-sm text-slate-300">Skills</span>
              </button>
              <button
                onClick={() => setIsCodexSyncOpen(true)}
                className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all flex items-center justify-center"
                title="Codex 配置同步"
              >
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </button>
            </div>
          </>
        )}

        <main className="space-y-4 animate-slide-up">
          {currentView === 'accounts' && (
            <>
              {accounts.length === 0 && !loading ? (
                <div className="text-center py-12 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">暂无账号</h3>
                  <p className="text-slate-400 max-w-sm mx-auto mb-6">
                    将 <span className="font-mono bg-slate-700 px-1 rounded text-xs">auth.json</span> 放入账号目录即可自动识别
                  </p>
                  <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="btn btn-primary"
                  >
                    添加账号
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {accounts.map(account => (
                    <motion.div
                      key={account.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
                    >
                      <AccountCard
                        account={account}
                        onSwitch={() => switchAccount(account.filePath)}
                        onEdit={() => setEditingAccount(account)}
                        renameAccount={renameAccount}
                        isBestCandidate={account.id === bestCandidateId}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </>
          )}

          {currentView === 'prompts' && (
            <PromptsPanel onBack={() => setCurrentView('accounts')} />
          )}

          {currentView === 'skills' && (
            <SkillsPanel onBack={() => setCurrentView('accounts')} />
          )}
        </main>

        <AddAccountDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
        />

        <EditAccountDialog
          isOpen={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          account={editingAccount}
          onSave={refresh}
        />

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          onRefresh={refresh}
        />

        <CodexSyncDialog
          isOpen={isCodexSyncOpen}
          onClose={() => setIsCodexSyncOpen(false)}
          webdavConfig={settings.webdav || { enabled: false, url: '', username: '', password: '', remotePath: '' }}
        />
      </div>
    </div>
  );
}

export default App;
