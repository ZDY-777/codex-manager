use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, Emitter};

// ========== 数据结构 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexTokens {
    pub access_token: String,
    pub account_id: String,
    pub id_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexAuthFile {
    #[serde(rename = "OPENAI_API_KEY")]
    pub openai_api_key: Option<String>,
    pub last_refresh: String,
    pub tokens: CodexTokens,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub id: String,           // account_id
    pub name: String,         // 文件名（不含扩展名）
    pub email: String,        // 从 JWT 解析
    #[serde(rename = "planType")]
    pub plan_type: String,
    #[serde(rename = "subscriptionEnd")]
    pub subscription_end: Option<String>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "filePath")]
    pub file_path: String,    // 认证文件完整路径
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<i64>, // Token 过期时间戳
    #[serde(rename = "lastRefresh")]
    pub last_refresh: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub accounts: Vec<AccountInfo>,
    #[serde(rename = "accountsDir")]
    pub accounts_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub accounts_dir: Option<String>,
}

// ========== 路径辅助函数 ==========

fn get_config_file() -> PathBuf {
    let home = dirs::home_dir().expect("无法获取用户目录");
    home.join(".myswitch").join("config.json")
}

fn load_config() -> AppConfig {
    let config_path = get_config_file();
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_file();
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

fn get_accounts_dir() -> PathBuf {
    let config = load_config();
    if let Some(dir) = config.accounts_dir {
        let path = PathBuf::from(dir);
        if path.exists() {
            return path;
        }
    }
    // 默认路径
    let home = dirs::home_dir().expect("无法获取用户目录");
    home.join(".myswitch").join("accounts")
}

fn get_codex_auth_file() -> PathBuf {
    let home = dirs::home_dir().expect("无法获取用户目录");
    home.join(".codex").join("auth.json")
}

// ========== JWT 解析 ==========

fn decode_jwt_payload(token: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    
    // Base64 URL 解码
    let payload = parts[1];
    let payload = payload.replace('-', "+").replace('_', "/");
    
    // 添加 padding
    let padding = match payload.len() % 4 {
        0 => 0,
        2 => 2,
        3 => 1,
        _ => return None,
    };
    let payload = format!("{}{}", payload, "=".repeat(padding));
    
    // 解码
    use std::io::Read;
    let mut decoder = base64::read::DecoderReader::new(
        payload.as_bytes(),
        &base64::engine::general_purpose::STANDARD,
    );
    let mut decoded = Vec::new();
    decoder.read_to_end(&mut decoded).ok()?;
    
    serde_json::from_slice(&decoded).ok()
}

fn extract_info_from_auth(auth: &CodexAuthFile) -> (String, String, Option<String>, Option<i64>) {
    // 尝试从 id_token 解析
    if let Some(payload) = decode_jwt_payload(&auth.tokens.id_token) {
        let email = payload.get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("未知")
            .to_string();
            
        let expires_at = payload.get("exp")
            .and_then(|v| v.as_i64());
        
        let auth_data = payload.get("https://api.openai.com/auth");
        
        let plan_type = auth_data
            .and_then(|a| a.get("chatgpt_plan_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        
        let subscription_end = auth_data
            .and_then(|a| a.get("chatgpt_subscription_active_until"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        return (email, plan_type, subscription_end, expires_at);
    }
    
    ("未知".to_string(), "unknown".to_string(), None, None)
}

// ========== Tauri 命令 ==========

/// 扫描账号目录，返回所有可用账号
#[tauri::command]
fn scan_accounts() -> Result<ScanResult, String> {
    let accounts_dir = get_accounts_dir();
    let codex_auth = get_codex_auth_file();
    
    // 确保目录存在
    if !accounts_dir.exists() {
        fs::create_dir_all(&accounts_dir)
            .map_err(|e| format!("创建账号目录失败: {}", e))?;
    }
    
    // 读取当前激活的 account_id
    let active_account_id = if codex_auth.exists() {
        fs::read_to_string(&codex_auth)
            .ok()
            .and_then(|content| serde_json::from_str::<CodexAuthFile>(&content).ok())
            .map(|auth| auth.tokens.account_id)
    } else {
        None
    };
    
    // 扫描目录中的所有 json 文件
    let mut accounts = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&accounts_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            
            // 只处理 .json 文件
            if path.extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            
            // 读取并解析
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(auth) = serde_json::from_str::<CodexAuthFile>(&content) {
                    let (email, plan_type, subscription_end, expires_at) = extract_info_from_auth(&auth);
                    
                    let name = path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("未命名")
                        .to_string();
                    
                    let is_active = active_account_id.as_ref()
                        .map(|id| id == &auth.tokens.account_id)
                        .unwrap_or(false);
                    
                    accounts.push(AccountInfo {
                        id: auth.tokens.account_id,
                        name,
                        email,
                        plan_type,
                        subscription_end,
                        is_active,
                        file_path: path.to_string_lossy().to_string(),
                        expires_at,
                        last_refresh: auth.last_refresh.clone(),
                    });
                }
            }
        }
    }
    
    Ok(ScanResult {
        accounts,
        accounts_dir: accounts_dir.to_string_lossy().to_string(),
    })
}

/// 切换到指定账号（复制认证文件到 ~/.codex/auth.json）
#[tauri::command]
fn switch_account(file_path: String) -> Result<(), String> {
    let source = PathBuf::from(&file_path);
    let target = get_codex_auth_file();
    
    if !source.exists() {
        return Err("认证文件不存在".to_string());
    }
    
    // 确保目标目录存在
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    // 复制文件
    fs::copy(&source, &target)
        .map_err(|e| format!("复制认证文件失败: {}", e))?;
    
    Ok(())
}

/// 打开账号目录
#[tauri::command]
fn open_accounts_dir() -> Result<String, String> {
    let dir = get_accounts_dir();
    // 确保目录存在
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    // 使用系统命令打开目录
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    
    Ok(dir.to_string_lossy().to_string())
}

/// 获取账号目录路径
#[tauri::command]
fn get_accounts_dir_path() -> String {
    let dir = get_accounts_dir();
    let _ = fs::create_dir_all(&dir);
    dir.to_string_lossy().to_string()
}

/// 获取应用配置
#[tauri::command]
fn get_app_config() -> AppConfig {
    load_config()
}

/// 设置账号目录
#[tauri::command]
fn set_accounts_dir(path: String) -> Result<(), String> {
    let old_dir = get_accounts_dir();
    let new_dir = PathBuf::from(&path);

    // Save configuration
    let mut config = load_config();
    config.accounts_dir = Some(path.clone());
    save_config(&config)?;

    // Auto-copy specific logic
    if old_dir != new_dir && old_dir.exists() {
         // Create new directory if needed
        if !new_dir.exists() {
            fs::create_dir_all(&new_dir).map_err(|e| format!("无法创建新目录: {}", e))?;
        }

        // Iterate and copy
        if let Ok(entries) = fs::read_dir(&old_dir) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "json") {
                    if let Some(file_name) = entry_path.file_name() {
                        let target_path = new_dir.join(file_name);
                        // Copy but don't error if fail (e.g. exists)
                        // Or maybe we want to preserve? Let's just copy.
                        if !target_path.exists() {
                            let _ = fs::copy(&entry_path, &target_path);
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

/// 重命名账号
#[tauri::command]
fn rename_account(old_path: String, new_name: String) -> Result<(), String> {
    let source = PathBuf::from(&old_path);
    if !source.exists() {
        return Err("源文件不存在".to_string());
    }
    
    let parent = source.parent().ok_or("无效的路径")?;
    let target = parent.join(format!("{}.json", new_name));
    
    if target.exists() {
        return Err("目标名称已存在".to_string());
    }
    
    fs::rename(source, target)
        .map_err(|e| format!("重命名失败: {}", e))?;
        
    Ok(())
}

/// 读取账号文件内容
#[tauri::command]
fn read_account_content(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    // 格式化 JSON
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;
    
    serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("格式化 JSON 失败: {}", e))
}

/// 更新账号文件内容
#[tauri::command]
fn update_account_content(file_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }
    
    // 验证 JSON 格式
    let auth: CodexAuthFile = serde_json::from_str(&content)
        .map_err(|e| format!("无效的 JSON 格式: {}", e))?;
    
    // 格式化并写入
    let pretty_content = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("序列化失败: {}", e))?;
    
    fs::write(&path, pretty_content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    Ok(())
}

/// 添加账号 (Save raw JSON content)
#[tauri::command]
fn add_account(name: String, content: String) -> Result<(), String> {
    // 1. 验证 JSON 格式
    let auth: CodexAuthFile = serde_json::from_str(&content)
        .map_err(|e| format!("无效的 JSON 格式: {}", e))?;
    
    // 2. 决定文件名
    let file_name = if !name.trim().is_empty() {
        name.trim().to_string()
    } else {
        // 尝试从 Token 提取 Email
        let (email, _, _, _) = extract_info_from_auth(&auth);
        if email != "未知" {
            email
        } else {
            // 随机或默认
             format!("account_{}",  std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())
        }
    };

    // 3. 构建路径
    let accounts_dir = get_accounts_dir();
    if !accounts_dir.exists() {
        fs::create_dir_all(&accounts_dir)
            .map_err(|e| format!("创建账号目录失败: {}", e))?;
    }
    
    let target_path = accounts_dir.join(format!("{}.json", file_name));
    
    // 4. 检查是否存在
    if target_path.exists() {
        return Err(format!("账号 '{}' 已存在", file_name));
    }
    
    // 5. 写入文件 (Pretty Print)
    let pretty_content = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("序列化失败: {}", e))?;
    
    fs::write(target_path, pretty_content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
        
    Ok(())
}

// ========== 用量查询 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitWindow {
    #[serde(rename = "usedPercent")]
    pub used_percent: f64,
    #[serde(rename = "windowMinutes")]
    pub window_minutes: Option<i64>,
    #[serde(rename = "resetsAt")]
    pub resets_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    #[serde(rename = "primaryWindow")]
    pub primary_window: Option<RateLimitWindow>,
    #[serde(rename = "secondaryWindow")]
    pub secondary_window: Option<RateLimitWindow>,
    #[serde(rename = "planType")]
    pub plan_type: Option<String>,
}

// API 响应结构
#[derive(Debug, Deserialize)]
struct ApiRateLimitWindow {
    used_percent: f64,
    limit_window_seconds: Option<i32>,
    reset_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ApiRateLimitDetails {
    primary_window: Option<ApiRateLimitWindow>,
    secondary_window: Option<ApiRateLimitWindow>,
}

#[derive(Debug, Deserialize)]
struct ApiUsageResponse {
    rate_limit: Option<ApiRateLimitDetails>,
    plan_type: Option<String>,
}

/// 获取账号的用量信息
#[tauri::command]
async fn fetch_usage(file_path: String) -> Result<UsageInfo, String> {
    // 读取认证文件
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取认证文件失败: {}", e))?;
    
    let auth: CodexAuthFile = serde_json::from_str(&content)
        .map_err(|e| format!("解析认证文件失败: {}", e))?;
    
    let access_token = &auth.tokens.access_token;
    let account_id = &auth.tokens.account_id;
    
    // 调用 OpenAI API
    let client = reqwest::Client::new();
    
    // 尝试不同的 Base URL 和 Path 组合
    let urls = vec![
        "https://chatgpt.com/backend-api/wham/usage",
        "https://api.openai.com/backend-api/wham/usage",
        "https://api.openai.com/api/codex/usage",
        "https://chat.openai.com/backend-api/wham/usage",
    ];

    let mut final_response = None;
    let mut last_error = String::new();

    for url in urls {
        println!("Trying URL: {}", url);
        
        let mut request = client
            .get(url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Origin", "https://chatgpt.com");
            
        // 如果有 account_id，必须带上
        if !account_id.is_empty() {
             request = request.header("ChatGPT-Account-Id", account_id);
        }
            
        match request.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    println!("Success with URL: {}", url);
                    final_response = Some(resp);
                    break;
                } else {
                    println!("Failed with URL: {} Status: {}", url, status);
                    last_error = format!("Status: {}", status);
                }
            },
            Err(e) => {
                println!("Network error with URL: {}: {}", url, e);
                last_error = e.to_string();
            }
        }
    }

    let response = final_response.ok_or_else(|| format!("所有 API 请求失败。最后尝试错误: {}", last_error))?;
    
    // 尝试解析，兼容不同的响应格式
    let api_response: ApiUsageResponse = response.json().await
        .map_err(|e| format!("解析 API 响应失败: {}", e))?;
    
    // 转换响应格式
    let map_window = |w: Option<ApiRateLimitWindow>| -> Option<RateLimitWindow> {
        w.map(|window| RateLimitWindow {
            used_percent: window.used_percent,
            window_minutes: window.limit_window_seconds.map(|s| (s as i64 + 59) / 60),
            resets_at: window.reset_at,
        })
    };
    
    let (primary, secondary) = match api_response.rate_limit {
        Some(details) => (
            map_window(details.primary_window),
            map_window(details.secondary_window),
        ),
        None => (None, None),
    };
    
    Ok(UsageInfo {
        primary_window: primary,
        secondary_window: secondary,
        plan_type: api_response.plan_type,
    })
}

// ========== WebDAV 同步 ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebDavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    #[serde(rename = "remotePath")]
    pub remote_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: Vec<String>,
    pub downloaded: Vec<String>,
    pub errors: Vec<String>,
}

/// 上传文件到 WebDAV
async fn webdav_upload(client: &reqwest::Client, config: &WebDavConfig, filename: &str, content: &str) -> Result<(), String> {
    let url = format!("{}{}{}", config.url.trim_end_matches('/'), config.remote_path, filename);
    
    let response = client
        .put(&url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Content-Type", "application/json")
        .body(content.to_string())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?;
    
    if response.status().is_success() || response.status().as_u16() == 201 {
        Ok(())
    } else {
        Err(format!("上传失败: HTTP {}", response.status()))
    }
}

/// 从 WebDAV 下载文件
async fn webdav_download(client: &reqwest::Client, config: &WebDavConfig, filename: &str) -> Result<String, String> {
    let url = format!("{}{}{}", config.url.trim_end_matches('/'), config.remote_path, filename);
    
    let response = client
        .get(&url)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    
    if response.status().is_success() {
        response.text().await.map_err(|e| format!("读取响应失败: {}", e))
    } else {
        Err(format!("下载失败: HTTP {}", response.status()))
    }
}

/// 列出 WebDAV 目录中的文件
async fn webdav_list(client: &reqwest::Client, config: &WebDavConfig) -> Result<Vec<String>, String> {
    let url = format!("{}{}", config.url.trim_end_matches('/'), config.remote_path);
    
    let response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "1")
        .header("Content-Type", "application/xml")
        .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/></prop></propfind>"#)
        .send()
        .await
        .map_err(|e| format!("列目录失败: {}", e))?;
    
    if !response.status().is_success() && response.status().as_u16() != 207 {
        return Err(format!("列目录失败: HTTP {}", response.status()));
    }
    
    let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    
    // 简单解析 XML 提取 .json 文件名
    let mut files = Vec::new();
    for line in body.lines() {
        if line.contains(".json") {
            // 提取文件名
            if let Some(start) = line.find(config.remote_path.as_str()) {
                let rest = &line[start + config.remote_path.len()..];
                if let Some(end) = rest.find('<') {
                    let filename = &rest[..end];
                    if filename.ends_with(".json") && !filename.is_empty() {
                        files.push(filename.to_string());
                    }
                }
            } else if let Some(start) = line.rfind('/') {
                let rest = &line[start + 1..];
                if let Some(end) = rest.find('<') {
                    let filename = &rest[..end];
                    if filename.ends_with(".json") && !filename.is_empty() {
                        files.push(filename.to_string());
                    }
                }
            }
        }
    }
    
    Ok(files)
}

/// 确保 WebDAV 远程目录存在
async fn webdav_ensure_dir(client: &reqwest::Client, config: &WebDavConfig) -> Result<(), String> {
    let url = format!("{}{}", config.url.trim_end_matches('/'), config.remote_path.trim_end_matches('/'));
    
    let response = client
        .request(reqwest::Method::from_bytes(b"MKCOL").unwrap(), &url)
        .basic_auth(&config.username, Some(&config.password))
        .send()
        .await
        .map_err(|e| format!("创建目录失败: {}", e))?;
    
    // 201 Created, 405 Already exists, 301 Redirect - all OK
    let status = response.status().as_u16();
    if status == 201 || status == 405 || status == 301 || response.status().is_success() {
        Ok(())
    } else {
        Err(format!("创建目录失败: HTTP {}", response.status()))
    }
}

/// 同步到 WebDAV (上传本地文件)
#[tauri::command]
async fn webdav_sync_upload(config: WebDavConfig) -> Result<SyncResult, String> {
    let client = reqwest::Client::new();
    let accounts_dir = get_accounts_dir();
    
    let mut result = SyncResult {
        uploaded: Vec::new(),
        downloaded: Vec::new(),
        errors: Vec::new(),
    };
    
    // 确保远程目录存在
    if let Err(e) = webdav_ensure_dir(&client, &config).await {
        // 忽略目录已存在的错误
        println!("创建目录: {}", e);
    }
    
    // 读取本地文件并上传
    if let Ok(entries) = fs::read_dir(&accounts_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                    match fs::read_to_string(&path) {
                        Ok(content) => {
                            match webdav_upload(&client, &config, filename, &content).await {
                                Ok(_) => result.uploaded.push(filename.to_string()),
                                Err(e) => result.errors.push(format!("{}: {}", filename, e)),
                            }
                        }
                        Err(e) => result.errors.push(format!("{}: 读取失败 {}", filename, e)),
                    }
                }
            }
        }
    }
    
    Ok(result)
}

/// 从 WebDAV 同步 (下载远程文件)
#[tauri::command]
async fn webdav_sync_download(config: WebDavConfig) -> Result<SyncResult, String> {
    let client = reqwest::Client::new();
    let accounts_dir = get_accounts_dir();
    
    let mut result = SyncResult {
        uploaded: Vec::new(),
        downloaded: Vec::new(),
        errors: Vec::new(),
    };
    
    // 确保本地目录存在
    if !accounts_dir.exists() {
        fs::create_dir_all(&accounts_dir).map_err(|e| format!("创建本地目录失败: {}", e))?;
    }
    
    // 列出远程文件
    let remote_files = webdav_list(&client, &config).await?;
    
    // 下载每个文件
    for filename in remote_files {
        match webdav_download(&client, &config, &filename).await {
            Ok(content) => {
                // 验证 JSON 格式
                if serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                    let local_path = accounts_dir.join(&filename);
                    match fs::write(&local_path, &content) {
                        Ok(_) => result.downloaded.push(filename),
                        Err(e) => result.errors.push(format!("{}: 写入失败 {}", filename, e)),
                    }
                } else {
                    result.errors.push(format!("{}: 无效的 JSON", filename));
                }
            }
            Err(e) => result.errors.push(format!("{}: {}", filename, e)),
        }
    }
    
    Ok(result)
}

/// 测试 WebDAV 连接
#[tauri::command]
async fn webdav_test_connection(config: WebDavConfig) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    // 尝试 PROPFIND 根目录
    let url = format!("{}{}", config.url.trim_end_matches('/'), config.remote_path);
    
    let response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|e| format!("连接失败: {}", e))?;
    
    let status = response.status();
    if status.is_success() || status.as_u16() == 207 {
        Ok("连接成功".to_string())
    } else if status.as_u16() == 404 {
        // 目录不存在，尝试创建
        webdav_ensure_dir(&client, &config).await?;
        Ok("连接成功，已创建远程目录".to_string())
    } else if status.as_u16() == 401 {
        Err("认证失败：请检查用户名和应用密码".to_string())
    } else {
        Err(format!("连接失败: HTTP {}", status))
    }
}

// ========== 入口 ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 阻止默认关闭行为，改为隐藏窗口
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            // 设置托盘菜单
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::TrayIconBuilder;
            
            // 获取当前激活账号信息
            let codex_auth = get_codex_auth_file();
            let account_info = if codex_auth.exists() {
                if let Ok(content) = fs::read_to_string(&codex_auth) {
                    if let Ok(auth) = serde_json::from_str::<CodexAuthFile>(&content) {
                        let (email, _, _, _) = extract_info_from_auth(&auth);
                        format!("当前: {}", email)
                    } else {
                        "当前: 未知".to_string()
                    }
                } else {
                    "当前: 未配置".to_string()
                }
            } else {
                "当前: 未配置".to_string()
            };
            
            let account_item = MenuItem::with_id(app, "account", &account_info, false, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "刷新", true, None::<&str>)?;
            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&account_item, &separator, &show, &refresh, &separator2, &quit])?;
            
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "refresh" => {
                            // 触发前端刷新
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.emit("tray-refresh", ());
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_accounts,
            switch_account,
            get_accounts_dir_path,
            open_accounts_dir,
            fetch_usage,
            rename_account,
            get_app_config,
            set_accounts_dir,
            add_account,
            read_account_content,
            update_account_content,
            webdav_sync_upload,
            webdav_sync_download,
            webdav_test_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
