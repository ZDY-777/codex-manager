import { useState, useEffect } from 'react';
import { AccountInfo } from '../types';

interface AccountCardProps {
    account: AccountInfo;
    onSwitch: () => void;
    onEdit: () => void;
    isBestCandidate?: boolean;
    renameAccount: (oldPath: string, newName: string) => Promise<any>;
}

export function AccountCard({ account, onSwitch, onEdit, isBestCandidate, renameAccount }: AccountCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(account.name);
    const [, setTick] = useState(0);

    useEffect(() => {
        setNewName(account.name);
    }, [account.name]);

    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const isTokenExpired = account.isTokenExpired;

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

    const formatResetTimeRelative = (timestamp?: number) => {
        if (!timestamp) return '';
        const now = Date.now();
        const target = timestamp * 1000;
        const diff = target - now;

        if (diff <= 0) return '已重置';

        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 60) {
            return `${minutes}分钟后`;
        } else if (hours < 24) {
            return `${hours}小时后`;
        } else {
            return `${days}天后`;
        }
    };

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'plus':
                return { text: 'Plus', color: 'bg-emerald-600/30 text-emerald-400' };
            case 'team':
                return { text: 'Team', color: 'bg-blue-600/30 text-blue-400' };
            case 'pro':
                return { text: 'Pro', color: 'bg-purple-600/30 text-purple-400' };
            default:
                return { text: plan, color: 'bg-slate-600/30 text-slate-400' };
        }
    };

    const handleRename = async () => {
        if (newName.trim() && newName !== account.name) {
            await renameAccount(account.filePath, newName);
        }
        setIsEditing(false);
    };

    const planBadge = getPlanBadge(account.planType);

    return (
        <div 
            className={`card group ${account.isActive ? 'card-active' : ''} p-5 cursor-pointer hover:border-slate-500 transition-colors`}
            onClick={(e) => {
                // 避免点击编辑名称或切换按钮时触发
                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
                    return;
                }
                onEdit();
            }}
        >
            {/* Header / Title Row */}
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                    {account.isActive && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse shadow-lg shadow-primary-500/50"></span>
                    )}

                    {isEditing ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm font-bold text-white focus:outline-none focus:border-primary-500 w-[120px]"
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
                                title="确认"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                            <button
                                onClick={() => {
                                    setNewName(account.name);
                                    setIsEditing(false);
                                }}
                                className="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                title="取消"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group/title cursor-pointer" onClick={() => setIsEditing(true)}>
                            <h3 className="font-bold text-xl text-white truncate max-w-[200px]" title={account.name}>{account.name}</h3>
                            <svg className="w-4 h-4 text-slate-600 opacity-0 group-hover/title:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                    )}

                    <span className={`px-2.5 py-0.5 text-xs rounded-md font-bold ${planBadge.color} border border-white/5`}>
                        {planBadge.text}
                    </span>

                    {/* Best Candidate Badge */}
                    {isBestCandidate && !account.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded-md font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            最佳账号
                        </span>
                    )}

                    {isTokenExpired && (
                        <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-fadeIn">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                            Token 过期
                        </span>
                    )}
                </div>

                {!account.isActive && (
                    <button
                        onClick={onSwitch}
                        disabled={!!isTokenExpired}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all transform active:scale-95 ${isTokenExpired
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white hover:shadow-lg border border-slate-600/50'
                            }`}
                    >
                        切换账号
                    </button>
                )}
            </div>

            {/* Split Layout: Info (Left) | Usage (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-x-8 gap-y-6">

                {/* Left Column: Account Info (3 Rows) */}
                <div className="flex flex-col justify-between h-full space-y-4 lg:space-y-0 text-sm"> {/* Flex col with space-between for height distribution */}

                    {/* Row 1: Email */}
                    <div className="flex items-center gap-3 text-slate-400 group/info">
                        <div className="p-2 rounded-lg bg-slate-800/50 group-hover/info:bg-slate-800 transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="truncate font-medium select-all" title={account.email}>{account.email}</span>
                    </div>

                    {/* Row 2: Query Time (Dynamic) */}
                    <div className="flex items-center gap-3 text-slate-400 group/info">
                        <div className="p-2 rounded-lg bg-slate-800/50 group-hover/info:bg-slate-800 transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="font-medium truncate animate-fade-in">
                            更新: {formatQueryTime(account.lastUsageUpdate)}
                        </span>
                    </div>

                    {/* Row 3: Subscription */}
                    <div className="flex items-center gap-3 text-slate-400 group/info">
                        <div className="p-2 rounded-lg bg-slate-800/50 group-hover/info:bg-slate-800 transition-colors shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className={`font-medium truncate ${isTokenExpired ? "text-red-400" : ""}`}>
                            有效期: {formatSubscription(account.subscriptionEnd)}
                        </span>
                    </div>
                </div>

                {/* Right Column: Usage Stats (2 Rows) */}
                <div className="flex flex-col justify-between h-full space-y-4 lg:space-y-0">
                    {/* Row 1: 5-Hour Limit */}
                    <div className="flex flex-col justify-center">
                        <div className="flex justify-between items-end text-xs mb-2">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">5小时限制</span>
                            <div className="flex gap-4 items-center">
                                <span className={`text-sm font-bold ${account.usage?.primaryWindow?.usedPercent! > 90 ? "text-red-400" :
                                    account.usage?.primaryWindow?.usedPercent! > 70 ? "text-yellow-400" : "text-emerald-400"
                                    }`}>
                                    {account.usage?.primaryWindow ? Math.max(0, 100 - Math.round(account.usage.primaryWindow.usedPercent)) : 0}% 剩余
                                </span>
                                <span className="text-slate-500 font-medium bg-slate-800/50 px-2 py-0.5 rounded ml-auto">
                                    {formatResetTimeRelative(account.usage?.primaryWindow?.resetsAt)}
                                </span>
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                            {account.usage?.primaryWindow && (
                                <div
                                    className={`h-full transition-all duration-700 ease-out rounded-full ${account.usage.primaryWindow.usedPercent > 90 ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                                        account.usage.primaryWindow.usedPercent > 70 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                                            'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                        }`}
                                    style={{ width: `${Math.min(100, account.usage.primaryWindow.usedPercent)}%` }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Row 2: Weekly Limit */}
                    <div className="flex flex-col justify-center">
                        <div className="flex justify-between items-end text-xs mb-2">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">每周限制</span>
                            <div className="flex gap-4 items-center">
                                <span className={`text-sm font-bold ${account.usage?.secondaryWindow?.usedPercent! > 90 ? "text-red-400" :
                                    account.usage?.secondaryWindow?.usedPercent! > 70 ? "text-yellow-400" : "text-blue-400"
                                    }`}>
                                    {account.usage?.secondaryWindow ? Math.max(0, 100 - Math.round(account.usage.secondaryWindow.usedPercent)) : 0}% 剩余
                                </span>
                                <span className="text-slate-500 font-medium bg-slate-800/50 px-2 py-0.5 rounded ml-auto">
                                    {formatResetTimeRelative(account.usage?.secondaryWindow?.resetsAt)}
                                </span>
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                            {account.usage?.secondaryWindow && (
                                <div
                                    className={`h-full transition-all duration-700 ease-out rounded-full ${account.usage.secondaryWindow.usedPercent > 90 ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                                        account.usage.secondaryWindow.usedPercent > 70 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                                            'bg-gradient-to-r from-blue-600 to-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                        }`}
                                    style={{ width: `${Math.min(100, account.usage.secondaryWindow.usedPercent)}%` }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
