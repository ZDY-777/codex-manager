import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { AccountInfo } from '../types';
import { GlassCard, CircularProgress } from './ui';

interface AccountCardProps {
  account: AccountInfo;
  onSwitch: () => void;
  onEdit: () => void;
  isBestCandidate?: boolean;
  renameAccount: (oldPath: string, newName: string) => Promise<any>;
  onRefresh?: () => void;
}

/**
 * 获取账号卡片的变体样式
 */
export function getAccountCardVariant(
  isActive: boolean,
  isTokenExpired: boolean
): 'default' | 'active' | 'danger' {
  if (isTokenExpired) return 'danger';
  if (isActive) return 'active';
  return 'default';
}

/**
 * 获取 Plan Badge 的样式类
 */
export function getPlanBadgeClasses(plan: string): { text: string; classes: string } {
  switch (plan) {
    case 'plus':
      return { text: 'Plus', classes: 'bg-gradient-to-r from-emerald-600/40 to-emerald-500/30 text-emerald-400 border-emerald-500/30' };
    case 'team':
      return { text: 'Team', classes: 'bg-gradient-to-r from-blue-600/40 to-blue-500/30 text-blue-400 border-blue-500/30' };
    case 'pro':
      return { text: 'Pro', classes: 'bg-gradient-to-r from-purple-600/40 to-purple-500/30 text-purple-400 border-purple-500/30' };
    default:
      return { text: plan, classes: 'bg-gradient-to-r from-slate-600/40 to-slate-500/30 text-slate-400 border-slate-500/30' };
  }
}

export function AccountCard({ account, onSwitch, onEdit, isBestCandidate, renameAccount, onRefresh }: AccountCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(account.name);
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setNewName(account.name);
  }, [account.name]);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const isTokenExpired = account.isTokenExpired;
  const cardVariant = getAccountCardVariant(account.isActive, !!isTokenExpired);
  const planBadge = getPlanBadgeClasses(account.planType);

  const formatSubscription = (date: string | null) => {
    if (!date) return '未知';
    const d = new Date(date);
    const now = new Date();
    const diffTime = d.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dateStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    if (daysLeft < 0) return `${dateStr} (已过期)`;
    if (daysLeft === 0) return `${dateStr} (今日到期)`;
    return `${dateStr} (${daysLeft}天后)`;
  };

  const formatQueryTime = (timestamp?: number) => {
    if (!timestamp) return '未查询';
    const d = new Date(timestamp);
    return d.toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleRename = async () => {
    if (newName.trim() && newName !== account.name) {
      await renameAccount(account.filePath, newName);
    }
    setIsEditing(false);
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const result = await invoke<string>('refresh_account_token', { filePath: account.filePath });
      console.log('Token 刷新结果:', result);
      alert(result);
      onRefresh?.();
    } catch (error) {
      console.error('Token 刷新失败:', error);
      alert(`刷新失败: ${error}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <GlassCard
      variant={cardVariant}
      glowOnActive={account.isActive}
      hoverable
      padding="md"
      className="group"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
          return;
        }
        onEdit();
      }}
    >
      {/* Header Row: 名称 + 标签 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {account.isActive && (
          <motion.span
            className="w-2 h-2 rounded-full bg-primary-500 shadow-glow"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-800/80 border border-white/20 rounded-lg px-2 py-0.5 text-sm font-bold text-white focus:outline-none focus:border-primary-500 w-[100px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setNewName(account.name);
                  setIsEditing(false);
                }
              }}
            />
            <button
              onClick={handleRename}
              className="p-1 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => { setNewName(account.name); setIsEditing(false); }}
              className="p-1 hover:bg-rose-500/20 text-rose-500 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 group/title cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            <h3 className="font-bold text-base text-white truncate max-w-[120px]" title={account.name}>
              {account.name}
            </h3>
            <svg className="w-3 h-3 text-slate-600 opacity-0 group-hover/title:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        )}

        <span className={`px-2 py-0.5 text-[10px] rounded-md font-bold border ${planBadge.classes}`}>
          {planBadge.text}
        </span>

        {isBestCandidate && !account.isActive && (
          <motion.span
            className="px-1.5 py-0.5 text-[10px] rounded-md font-bold bg-gradient-to-r from-amber-500/30 to-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            最佳
          </motion.span>
        )}

        {isTokenExpired && (
          <motion.span
            className="px-1.5 py-0.5 text-[10px] rounded-md font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-0.5"
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <span className="w-1 h-1 rounded-full bg-rose-500" />
            过期
          </motion.span>
        )}
      </div>

      {/* Content: 左侧信息 | 中间进度环 | 右侧按钮 */}
      <div className="flex items-center gap-4">
        {/* Left: Account Info */}
        <div className="flex flex-col space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate text-xs select-all" title={account.email}>{account.email}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs truncate">{formatQueryTime(account.lastUsageUpdate)}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-xs truncate ${isTokenExpired ? 'text-rose-400' : ''}`}>
              {formatSubscription(account.subscriptionEnd)}
            </span>
          </div>
        </div>

        {/* Center: Circular Progress */}
        <div className="flex gap-4 items-center flex-shrink-0">
          <CircularProgress
            value={account.usage?.primaryWindow?.usedPercent ?? 0}
            size={72}
            strokeWidth={6}
            label="5小时"
          />
          <CircularProgress
            value={account.usage?.secondaryWindow?.usedPercent ?? 0}
            size={72}
            strokeWidth={6}
            label="每周"
          />
        </div>

        {/* Right: Icon Buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefreshToken();
            }}
            disabled={refreshing}
            title="刷新 Token"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>

          {!account.isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwitch();
              }}
              disabled={!!isTokenExpired}
              title="切换到此账号"
              className="p-2 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
