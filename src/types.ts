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
