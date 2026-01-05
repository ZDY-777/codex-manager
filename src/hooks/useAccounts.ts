import { useState, useEffect, useCallback, useMemo } from 'react';
import { AccountInfo, ScanResult, UsageInfo, AppSettings, DEFAULT_SETTINGS } from '../types';
import { invoke } from '@tauri-apps/api/core';

export function useAccounts() {
    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [accountsDir, setAccountsDirState] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem('codex_manager_settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...newSettings };
            localStorage.setItem('codex_manager_settings', JSON.stringify(next));
            return next;
        });
    }, []);

    const fetchUsage = useCallback(async (filePath: string): Promise<UsageInfo> => {
        return await invoke<UsageInfo>('fetch_usage', { filePath });
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const result = await invoke<ScanResult>('scan_accounts');

            setAccountsDirState(result.accountsDir);

            const accountsWithUsage = await Promise.all(
                result.accounts.map(async (account) => {
                    try {
                        const usage = await fetchUsage(account.filePath);
                        return {
                            ...account,
                            usage,
                            lastUsageUpdate: Date.now(),
                            isTokenExpired: false
                        };
                    } catch (error: any) {
                        const errStr = error.toString();
                        const isExpired = errStr.includes('401') || errStr.includes('403') || errStr.includes('Status: 401') || errStr.includes('Status: 403');
                        return {
                            ...account,
                            usage: undefined,
                            lastUsageUpdate: Date.now(),
                            isTokenExpired: isExpired
                        };
                    }
                })
            );

            // 排序：优先显示激活的账号，其次按名称
            accountsWithUsage.sort((a, b) => {
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return a.name.localeCompare(b.name, 'zh-CN');
            });

            setAccounts(accountsWithUsage);

        } catch (error) {
            console.error('扫描账号失败:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchUsage]);

    const switchAccount = useCallback(async (filePath: string) => {
        try {
            await invoke('switch_account', { filePath });

            // 乐观更新：先在本地标记新账号为激活，避免等待完整 refresh
            setAccounts(prev => prev.map(acc => {
                if (acc.filePath === filePath) return { ...acc, isActive: true };
                if (acc.isActive) return { ...acc, isActive: false };
                return acc;
            }));

            await refresh(); // 刷新状态
            return { success: true, message: '已切换账号' };
        } catch (error: any) {
            return { success: false, message: error.toString() };
        }
    }, [refresh]);

    const checkAutoSwitch = useCallback(async (currentAccounts: AccountInfo[]) => {
        if (!settings.enableAutoSwitch) return;

        const activeAccount = currentAccounts.find(a => a.isActive);
        if (!activeAccount) return;

        const threshold = Math.max(1, Math.min(50, settings.autoSwitchThreshold || DEFAULT_SETTINGS.autoSwitchThreshold));
        const usedPercentLimit = 100 - threshold;

        // 判断当前账号是否需要切换
        const isExpired = activeAccount.isTokenExpired;
        const isPrimaryFull = (activeAccount.usage?.primaryWindow?.usedPercent || 0) >= usedPercentLimit;
        const isSecondaryFull = (activeAccount.usage?.secondaryWindow?.usedPercent || 0) >= usedPercentLimit;

        if (isExpired || isPrimaryFull || isSecondaryFull) {
            // 筛选候选账号
            const candidates = currentAccounts.filter(acc => {
                if (acc.isActive) return false; // 排除自己
                if (acc.isTokenExpired) return false; // 排除过期
                if ((acc.usage?.primaryWindow?.usedPercent || 0) >= usedPercentLimit) return false; // 排除满额
                if ((acc.usage?.secondaryWindow?.usedPercent || 0) >= usedPercentLimit) return false; // 排除满额
                return true;
            });

            if (candidates.length === 0) return;

            // 排序算法：周重置时间最早 (ResetsAt Smallest) 的账号
            candidates.sort((a, b) => {
                const resetA = a.usage?.secondaryWindow?.resetsAt || Number.MAX_SAFE_INTEGER;
                const resetB = b.usage?.secondaryWindow?.resetsAt || Number.MAX_SAFE_INTEGER;
                return resetA - resetB;
            });

            const bestAccount = candidates[0];
            // 执行切换
            await switchAccount(bestAccount.filePath);
        }
    }, [settings.enableAutoSwitch, switchAccount]);

    // 计算最佳候选账号 (Best Candidate)
    const bestCandidateId = useMemo(() => {
        const candidates = accounts.filter(acc => {
            // if (acc.isActive) return false; // Don't exclude active. If active is best, we shouldn't show badge on others.
            if (acc.isTokenExpired) return false;
            // Strict usage check. If current account is active but near full, maybe it shouldn't be best?
            // Actually, if it's active and functioning, it's valid.
            // But if it's > 99%, we probably shouldn't count it as "Best" available.
            if ((acc.usage?.primaryWindow?.usedPercent || 0) >= 99) return false;
            if ((acc.usage?.secondaryWindow?.usedPercent || 0) >= 99) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        // 排序：仅依据周重置时间最早 (ResetsAt Smallest)
        candidates.sort((a, b) => {
            const resetA = a.usage?.secondaryWindow?.resetsAt || Number.MAX_SAFE_INTEGER;
            const resetB = b.usage?.secondaryWindow?.resetsAt || Number.MAX_SAFE_INTEGER;
            return resetA - resetB;
        });

        return candidates[0].id;
    }, [accounts]);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!settings.autoCheck || settings.checkInterval <= 0) return;
        const intervalId = setInterval(() => {
            refresh();
        }, settings.checkInterval * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [settings.autoCheck, settings.checkInterval, refresh]);

    useEffect(() => {
        if (!settings.enableAutoSwitch) return;
        if (accounts.length === 0) return;
        checkAutoSwitch(accounts);
    }, [accounts, settings.enableAutoSwitch, checkAutoSwitch]);

    const renameAccount = useCallback(async (oldPath: string, newName: string) => {
        // Find the account ID first to ensure we update the right one reliably
        const targetAccount = accounts.find(a => a.filePath === oldPath);
        const targetId = targetAccount?.id;

        if (targetId) {
            // 1. Optimistic Update (Immediate UI Feedback via ID)
            setAccounts(prevAccounts => prevAccounts.map(acc => {
                if (acc.id === targetId) {
                    return { ...acc, name: newName };
                }
                return acc;
            }));
        } else {
            // Fallback to path if ID not found (shouldn't happen)
            setAccounts(prevAccounts => prevAccounts.map(acc => {
                if (acc.filePath === oldPath) {
                    return { ...acc, name: newName };
                }
                return acc;
            }));
        }

        try {
            await invoke('rename_account', { oldPath, newName });
            // Add a delay to ensure FS operation is seen by scan
            await new Promise(resolve => setTimeout(resolve, 800)); // Increased to 800ms for safety
            await refresh();
            return { success: true };
        } catch (error: any) {
            console.error("Rename failed:", error);
            await refresh(); // Force sync
            return { success: false, message: error.toString() };
        }
    }, [accounts, refresh]); // Added accounts dependency

    const setAccountsDir = useCallback(async (path: string) => {
        try {
            await invoke('set_accounts_dir', { path });
            await refresh();
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.toString() };
        }
    }, [refresh]);

    const addAccount = useCallback(async (name: string, content: string) => {
        try {
            await invoke('add_account', { name, content });
            await refresh();
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.toString() };
        }
    }, [refresh]);

    const getAccountsDir = useCallback(async () => {
        try {
            return await invoke<string>('get_accounts_dir_path');
        } catch {
            return accountsDir;
        }
    }, [accountsDir]);

    return {
        accounts,
        accountsDir,
        loading,
        settings,
        updateSettings,
        refresh,
        switchAccount,
        renameAccount,
        setAccountsDir,
        addAccount,
        getAccountsDir,
        bestCandidateId,
    };
}
