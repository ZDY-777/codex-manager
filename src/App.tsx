import { useState } from 'react';
import { Header } from './components/Header';
import { AccountCard } from './components/AccountCard';
import { AddAccountDialog } from './components/AddAccountDialog';
import { EditAccountDialog } from './components/EditAccountDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { useAccounts } from './hooks/useAccounts';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { AccountInfo } from './types';

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

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        <Header
          onRefresh={refresh}
          onOpenDir={handleOpenDir}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onAddAccount={() => setIsAddDialogOpen(true)}
          loading={loading}
        />

        <main className="space-y-4 animate-slide-up">
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
      </div>
    </div>
  );
}

export default App;
