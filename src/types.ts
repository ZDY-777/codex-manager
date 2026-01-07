export interface UsageInfo {
    primaryWindow?: {
        usedPercent: number;
        windowMinutes?: number;
        resetsAt?: number;
    };
    secondaryWindow?: {
        usedPercent: number;
        windowMinutes?: number;
        resetsAt?: number;
    };
    planType?: string;
}

export interface AccountInfo {
    id: string;
    name: string;
    email: string;
    planType: string;
    subscriptionEnd: string | null;
    isActive: boolean;
    filePath: string;
    usage?: UsageInfo;
    expiresAt?: number; // Deprecated
    lastRefresh: string;
    lastUsageUpdate?: number;
    isTokenExpired?: boolean;
}

export interface ScanResult {
    accounts: AccountInfo[];
    accountsDir: string;
}

export interface WebDavConfig {
    enabled: boolean;
    url: string;        // https://dav.jianguoyun.com/dav/
    username: string;   // 坚果云登录邮箱
    password: string;   // 应用专用密码
    remotePath: string; // 远程目录路径，如 /codex-manager/
}

export interface AppSettings {
    accountsDir?: string;
    autoCheck: boolean;
    checkInterval: number; // minutes
    enableAutoSwitch: boolean;
    autoSwitchThreshold: number; // percent remaining to trigger switch
    webdav?: WebDavConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
    autoCheck: true,
    checkInterval: 30,
    enableAutoSwitch: false,
    autoSwitchThreshold: 5,
    webdav: {
        enabled: false,
        url: 'https://dav.jianguoyun.com/dav/',
        username: '',
        password: '',
        remotePath: '/codex-manager/',
    },
};

// ========== Prompts & Skills ==========

export interface PromptInfo {
    name: string;
    description: string;
    argumentHint?: string;
    filePath: string;
    content: string;
}

export interface SkillInfo {
    name: string;
    description: string;
    compatibility?: string;
    dirPath: string;
    hasScripts: boolean;
    hasAssets: boolean;
    hasReferences: boolean;
}

export interface CodexSyncConfig {
    syncPrompts: boolean;
    syncSkills: boolean;
    syncAgentsMd: boolean;
    syncModelConfig: boolean;      // model, model_reasoning_effort
    syncMcpServers: boolean;       // mcp_servers.*
    syncOtherConfig: boolean;      // notice.* 等其他配置
}

export const DEFAULT_CODEX_SYNC_CONFIG: CodexSyncConfig = {
    syncPrompts: true,
    syncSkills: true,
    syncAgentsMd: true,
    syncModelConfig: true,
    syncMcpServers: false,         // 默认不同步（路径因设备而异）
    syncOtherConfig: false,
};

export interface SyncResult {
    uploaded: string[];
    downloaded: string[];
    errors: string[];
}
