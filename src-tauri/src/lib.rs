use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{Emitter, Manager};

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

/// 创建带超时的 WebDAV 客户端，避免卡住无响应
fn webdav_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(60))  // 坚果云 PROPFIND 可能较慢，增加超时
        .build()
        .map_err(|e| format!("创建 WebDAV 客户端失败: {}", e))
}

/// 规范化远程目录，确保前后斜杠存在
fn normalize_remote_path(path: &str) -> String {
    let mut p = path.trim().to_string();
    if !p.starts_with('/') {
        p.insert(0, '/');
    }
    if !p.ends_with('/') {
        p.push('/');
    }
    p
}

/// 上传文件到 WebDAV
async fn webdav_upload(client: &reqwest::Client, config: &WebDavConfig, filename: &str, content: &str) -> Result<(), String> {
    let remote_path = normalize_remote_path(&config.remote_path);
    // 对文件名进行 URL 编码（处理中文文件名）
    let encoded_filename = urlencoding::encode(filename);
    let url = format!("{}{}{}", config.url.trim_end_matches('/'), remote_path, encoded_filename);
    
    println!("[WebDAV] 上传文件: {}", url);
    
    let response = client
        .put(&url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Content-Type", "application/json; charset=utf-8")
        .body(content.to_string())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?;
    
    let status = response.status();
    println!("[WebDAV] 上传响应状态: {}", status);
    
    if status.is_success() || status.as_u16() == 201 {
        Ok(())
    } else {
        Err(format!("上传失败: HTTP {}", status))
    }
}

/// 从 WebDAV 下载文件
async fn webdav_download(client: &reqwest::Client, config: &WebDavConfig, filename: &str) -> Result<String, String> {
    let remote_path = normalize_remote_path(&config.remote_path);
    // 对文件名进行 URL 编码（处理中文文件名）
    let encoded_filename = urlencoding::encode(filename);
    let url = format!("{}{}{}", config.url.trim_end_matches('/'), remote_path, encoded_filename);
    
    println!("[WebDAV] 下载文件: {}", url);
    
    let response = client
        .get(&url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Accept", "*/*")
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    
    let status = response.status();
    println!("[WebDAV] 下载响应状态: {}", status);
    
    if status.is_success() {
        let content = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        println!("[WebDAV] 下载成功: {} ({} 字节)", filename, content.len());
        Ok(content)
    } else {
        Err(format!("下载失败: HTTP {}", status))
    }
}

/// 列出 WebDAV 目录中的文件
async fn webdav_list(client: &reqwest::Client, config: &WebDavConfig) -> Result<Vec<String>, String> {
    let remote_path = normalize_remote_path(&config.remote_path);
    let url = format!("{}{}", config.url.trim_end_matches('/'), remote_path);
    
    println!("[WebDAV] 列目录请求: {}", url);
    
    let response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "1")
        .header("Content-Type", "application/xml; charset=utf-8")
        .header("Accept", "*/*")
        .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/><getcontentlength/></prop></propfind>"#)
        .send()
        .await
        .map_err(|e| format!("列目录失败: {}", e))?;
    
    let status = response.status();
    println!("[WebDAV] 列目录响应状态: {}", status);
    
    if !status.is_success() && status.as_u16() != 207 {
        return Err(format!("列目录失败: HTTP {}", status));
    }
    
    let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    println!("[WebDAV] 响应长度: {} 字节", body.len());
    println!("[WebDAV] 响应内容: {}", &body[..body.len().min(500)]);
    
    // 使用正则表达式提取 href 内容，更可靠
    let mut files = Vec::new();
    
    // 匹配 <d:href>...</d:href> 或 <D:href>...</D:href> 或 <href>...</href>
    let href_patterns = ["<d:href>", "<D:href>", "<href>"];
    let href_end_patterns = ["</d:href>", "</D:href>", "</href>"];
    
    for (start_pat, end_pat) in href_patterns.iter().zip(href_end_patterns.iter()) {
        let mut search_pos = 0;
        while let Some(start_idx) = body[search_pos..].find(start_pat) {
            let abs_start = search_pos + start_idx + start_pat.len();
            if let Some(end_idx) = body[abs_start..].find(end_pat) {
                let href_content = &body[abs_start..abs_start + end_idx];
                println!("[WebDAV] 找到 href: {}", href_content);
                
                // URL 解码
                let decoded = urlencoding::decode(href_content).unwrap_or_else(|_| href_content.into());
                
                // 提取文件名
                if let Some(name) = decoded.rsplit('/').next() {
                    if name.ends_with(".json") && !name.is_empty() {
                        println!("[WebDAV] 发现文件: {}", name);
                        if !files.contains(&name.to_string()) {
                            files.push(name.to_string());
                        }
                    }
                }
                search_pos = abs_start + end_idx;
            } else {
                break;
            }
        }
    }
    
    println!("[WebDAV] 共发现 {} 个 JSON 文件", files.len());
    Ok(files)
}

/// 确保 WebDAV 远程目录存在
async fn webdav_ensure_dir(client: &reqwest::Client, config: &WebDavConfig) -> Result<(), String> {
    let remote_path = normalize_remote_path(&config.remote_path);
    let url = format!("{}{}", config.url.trim_end_matches('/'), remote_path.trim_end_matches('/'));
    
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

/// 同步账号到 WebDAV (上传本地账号文件到 accounts/ 子目录)
#[tauri::command]
async fn webdav_sync_upload(config: WebDavConfig) -> Result<SyncResult, String> {
    let client = webdav_client()?;
    let accounts_dir = get_accounts_dir();
    
    let mut result = SyncResult {
        uploaded: Vec::new(),
        downloaded: Vec::new(),
        errors: Vec::new(),
    };
    
    // 确保远程根目录存在
    if let Err(e) = webdav_ensure_dir(&client, &config).await {
        println!("创建根目录: {}", e);
    }
    
    // 创建 accounts 子目录
    let accounts_remote_path = format!("{}accounts/", config.remote_path.trim_end_matches('/'));
    let accounts_config = WebDavConfig {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        remote_path: accounts_remote_path,
    };
    if let Err(e) = webdav_ensure_dir(&client, &accounts_config).await {
        println!("创建 accounts 目录: {}", e);
    }
    
    // 读取本地文件并上传到 accounts/ 子目录
    if let Ok(entries) = fs::read_dir(&accounts_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                    match fs::read_to_string(&path) {
                        Ok(content) => {
                            match webdav_upload(&client, &accounts_config, filename, &content).await {
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

/// 从 WebDAV 同步账号 (从 accounts/ 子目录下载)
#[tauri::command]
async fn webdav_sync_download(config: WebDavConfig) -> Result<SyncResult, String> {
    let client = webdav_client()?;
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
    
    // 从 accounts/ 子目录下载
    let accounts_remote_path = format!("{}accounts/", config.remote_path.trim_end_matches('/'));
    let accounts_config = WebDavConfig {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        remote_path: accounts_remote_path,
    };
    
    // 列出远程文件
    let remote_files = webdav_list(&client, &accounts_config).await?;
    
    // 下载每个文件
    for filename in remote_files {
        match webdav_download(&client, &accounts_config, &filename).await {
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
    let client = webdav_client()?;
    let remote_path = normalize_remote_path(&config.remote_path);
    
    // 尝试 PROPFIND 根目录
    let url = format!("{}{}", config.url.trim_end_matches('/'), remote_path);
    
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

// ========== Prompts & Skills 管理 ==========

fn get_codex_dir() -> PathBuf {
    let home = dirs::home_dir().expect("无法获取用户目录");
    home.join(".codex")
}

fn get_prompts_dir() -> PathBuf {
    get_codex_dir().join("prompts")
}

fn get_skills_dir() -> PathBuf {
    get_codex_dir().join("skills")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptInfo {
    pub name: String,
    pub description: String,
    #[serde(rename = "argumentHint")]
    pub argument_hint: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub compatibility: Option<String>,
    #[serde(rename = "dirPath")]
    pub dir_path: String,
    #[serde(rename = "hasScripts")]
    pub has_scripts: bool,
    #[serde(rename = "hasAssets")]
    pub has_assets: bool,
    #[serde(rename = "hasReferences")]
    pub has_references: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexSyncConfig {
    #[serde(rename = "syncPrompts")]
    pub sync_prompts: bool,
    #[serde(rename = "syncSkills")]
    pub sync_skills: bool,
    #[serde(rename = "syncAgentsMd")]
    pub sync_agents_md: bool,
    #[serde(rename = "syncConfigToml")]
    pub sync_config_toml: bool,
}

impl Default for CodexSyncConfig {
    fn default() -> Self {
        Self {
            sync_prompts: true,
            sync_skills: true,
            sync_agents_md: true,
            sync_config_toml: false,
        }
    }
}

/// 解析 Markdown frontmatter (YAML)
fn parse_frontmatter(content: &str) -> Option<serde_json::Value> {
    let content = content.trim();
    if !content.starts_with("---") {
        return None;
    }
    
    let rest = &content[3..];
    if let Some(end_idx) = rest.find("\n---") {
        let yaml_str = &rest[..end_idx].trim();
        // 简单解析 YAML 为 JSON
        let mut map = serde_json::Map::new();
        for line in yaml_str.lines() {
            if let Some(colon_idx) = line.find(':') {
                let key = line[..colon_idx].trim().to_string();
                let value = line[colon_idx + 1..].trim();
                // 去掉引号
                let value = value.trim_matches('"').trim_matches('\'');
                // 处理多行值 (以 > 开头)
                if value == ">" || value == "|" {
                    continue; // 跳过多行标记，后续行会被忽略
                }
                map.insert(key, serde_json::Value::String(value.to_string()));
            }
        }
        if !map.is_empty() {
            return Some(serde_json::Value::Object(map));
        }
    }
    None
}

/// 递归扫描 prompts 目录
fn scan_prompts_recursive(dir: &PathBuf, prompts: &mut Vec<PromptInfo>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // 递归扫描子目录
                scan_prompts_recursive(&path, prompts);
            } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let frontmatter = parse_frontmatter(&content);
                    
                    let name = path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("未命名")
                        .to_string();
                    
                    let description = frontmatter.as_ref()
                        .and_then(|fm| fm.get("description"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    
                    let argument_hint = frontmatter.as_ref()
                        .and_then(|fm| fm.get("argument-hint"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    
                    prompts.push(PromptInfo {
                        name,
                        description,
                        argument_hint,
                        file_path: path.to_string_lossy().to_string(),
                        content,
                    });
                }
            }
        }
    }
}

/// 扫描所有 prompts
#[tauri::command]
fn scan_prompts() -> Result<Vec<PromptInfo>, String> {
    let prompts_dir = get_prompts_dir();
    let mut prompts = Vec::new();
    
    if prompts_dir.exists() {
        scan_prompts_recursive(&prompts_dir, &mut prompts);
    }
    
    Ok(prompts)
}

/// 扫描所有 skills
#[tauri::command]
fn scan_skills() -> Result<Vec<SkillInfo>, String> {
    let skills_dir = get_skills_dir();
    let mut skills = Vec::new();
    
    if !skills_dir.exists() {
        return Ok(skills);
    }
    
    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            
            // 跳过 .system 和 dist 目录
            let dir_name = path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            if dir_name.starts_with('.') || dir_name == "dist" {
                continue;
            }
            
            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }
            
            if let Ok(content) = fs::read_to_string(&skill_md) {
                let frontmatter = parse_frontmatter(&content);
                
                let name = frontmatter.as_ref()
                    .and_then(|fm| fm.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(dir_name)
                    .to_string();
                
                let description = frontmatter.as_ref()
                    .and_then(|fm| fm.get("description"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                
                let compatibility = frontmatter.as_ref()
                    .and_then(|fm| fm.get("compatibility"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                
                skills.push(SkillInfo {
                    name,
                    description,
                    compatibility,
                    dir_path: path.to_string_lossy().to_string(),
                    has_scripts: path.join("scripts").exists(),
                    has_assets: path.join("assets").exists(),
                    has_references: path.join("references").exists(),
                });
            }
        }
    }
    
    Ok(skills)
}

/// 读取 prompt 内容
#[tauri::command]
fn read_prompt_content(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 保存 prompt 内容
#[tauri::command]
fn save_prompt_content(file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, content)
        .map_err(|e| format!("保存文件失败: {}", e))
}

/// 创建新 prompt
#[tauri::command]
fn create_prompt(name: String, description: String, content: String) -> Result<String, String> {
    let prompts_dir = get_prompts_dir();
    if !prompts_dir.exists() {
        fs::create_dir_all(&prompts_dir)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    let file_name = format!("{}.md", name);
    let file_path = prompts_dir.join(&file_name);
    
    if file_path.exists() {
        return Err(format!("Prompt '{}' 已存在", name));
    }
    
    let full_content = format!(
        "---\ndescription: {}\n---\n\n{}",
        description, content
    );
    
    fs::write(&file_path, full_content)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

/// 删除 prompt
#[tauri::command]
fn delete_prompt(file_path: String) -> Result<(), String> {
    fs::remove_file(&file_path)
        .map_err(|e| format!("删除文件失败: {}", e))
}

/// 读取 skill 的 SKILL.md 内容
#[tauri::command]
fn read_skill_content(dir_path: String) -> Result<String, String> {
    let skill_md = PathBuf::from(&dir_path).join("SKILL.md");
    fs::read_to_string(&skill_md)
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 保存 skill 的 SKILL.md 内容
#[tauri::command]
fn save_skill_content(dir_path: String, content: String) -> Result<(), String> {
    let skill_md = PathBuf::from(&dir_path).join("SKILL.md");
    fs::write(&skill_md, content)
        .map_err(|e| format!("保存文件失败: {}", e))
}

/// 创建新 skill
#[tauri::command]
fn create_skill(name: String, description: String) -> Result<String, String> {
    let skills_dir = get_skills_dir();
    let skill_dir = skills_dir.join(&name);
    
    if skill_dir.exists() {
        return Err(format!("Skill '{}' 已存在", name));
    }
    
    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;
    
    let skill_md_content = format!(
        "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n## When to Use\n- TODO\n\n## When NOT to Use\n- TODO\n\n## Workflow\n1. TODO\n",
        name, description, name
    );
    
    let skill_md = skill_dir.join("SKILL.md");
    fs::write(&skill_md, skill_md_content)
        .map_err(|e| format!("创建 SKILL.md 失败: {}", e))?;
    
    Ok(skill_dir.to_string_lossy().to_string())
}

/// 删除 skill
#[tauri::command]
fn delete_skill(dir_path: String) -> Result<(), String> {
    fs::remove_dir_all(&dir_path)
        .map_err(|e| format!("删除目录失败: {}", e))
}

/// 读取 AGENTS.MD
#[tauri::command]
fn read_agents_md() -> Result<String, String> {
    let agents_md = get_codex_dir().join("AGENTS.MD");
    if agents_md.exists() {
        fs::read_to_string(&agents_md)
            .map_err(|e| format!("读取文件失败: {}", e))
    } else {
        Ok(String::new())
    }
}

/// 保存 AGENTS.MD
#[tauri::command]
fn save_agents_md(content: String) -> Result<(), String> {
    let agents_md = get_codex_dir().join("AGENTS.MD");
    fs::write(&agents_md, content)
        .map_err(|e| format!("保存文件失败: {}", e))
}

/// 读取 config.toml
#[tauri::command]
fn read_config_toml() -> Result<String, String> {
    let config_toml = get_codex_dir().join("config.toml");
    if config_toml.exists() {
        fs::read_to_string(&config_toml)
            .map_err(|e| format!("读取文件失败: {}", e))
    } else {
        Ok(String::new())
    }
}

/// 保存 config.toml
#[tauri::command]
fn save_config_toml(content: String) -> Result<(), String> {
    let config_toml = get_codex_dir().join("config.toml");
    fs::write(&config_toml, content)
        .map_err(|e| format!("保存文件失败: {}", e))
}

/// 打开 Codex 目录
#[tauri::command]
fn open_codex_dir() -> Result<String, String> {
    let dir = get_codex_dir();
    
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

// ========== Codex WebDAV 同步 ==========

/// 同步 Codex 配置到 WebDAV (prompts, skills, AGENTS.MD)
#[tauri::command]
async fn webdav_sync_codex_upload(config: WebDavConfig, sync_config: CodexSyncConfig) -> Result<SyncResult, String> {
    let client = webdav_client()?;
    let codex_dir = get_codex_dir();
    
    let mut result = SyncResult {
        uploaded: Vec::new(),
        downloaded: Vec::new(),
        errors: Vec::new(),
    };
    
    // 确保远程根目录存在
    if let Err(e) = webdav_ensure_dir(&client, &config).await {
        println!("创建根目录: {}", e);
    }
    
    let base_path = config.remote_path.trim_end_matches('/');
    
    // 同步 AGENTS.MD (直接放在根目录)
    if sync_config.sync_agents_md {
        let agents_md = codex_dir.join("AGENTS.MD");
        if agents_md.exists() {
            if let Ok(content) = fs::read_to_string(&agents_md) {
                match webdav_upload(&client, &config, "AGENTS.MD", &content).await {
                    Ok(_) => result.uploaded.push("AGENTS.MD".to_string()),
                    Err(e) => result.errors.push(format!("AGENTS.MD: {}", e)),
                }
            }
        }
    }
    
    // 同步 config.toml (直接放在根目录)
    if sync_config.sync_config_toml {
        let config_toml = codex_dir.join("config.toml");
        if config_toml.exists() {
            if let Ok(content) = fs::read_to_string(&config_toml) {
                match webdav_upload(&client, &config, "config.toml", &content).await {
                    Ok(_) => result.uploaded.push("config.toml".to_string()),
                    Err(e) => result.errors.push(format!("config.toml: {}", e)),
                }
            }
        }
    }
    
    // 同步 prompts
    if sync_config.sync_prompts {
        let prompts_remote = format!("{}/prompts/", base_path);
        let prompts_config = WebDavConfig {
            url: config.url.clone(),
            username: config.username.clone(),
            password: config.password.clone(),
            remote_path: prompts_remote,
        };
        let _ = webdav_ensure_dir(&client, &prompts_config).await;
        
        let prompts_dir = get_prompts_dir();
        if prompts_dir.exists() {
            upload_dir_recursive(&client, &prompts_config, &prompts_dir, &mut result).await;
        }
    }
    
    // 同步 skills
    if sync_config.sync_skills {
        let skills_remote = format!("{}/skills/", base_path);
        let skills_config = WebDavConfig {
            url: config.url.clone(),
            username: config.username.clone(),
            password: config.password.clone(),
            remote_path: skills_remote,
        };
        let _ = webdav_ensure_dir(&client, &skills_config).await;
        
        let skills_dir = get_skills_dir();
        if skills_dir.exists() {
            // 遍历 skills 目录
            if let Ok(entries) = fs::read_dir(&skills_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_dir() {
                        continue;
                    }
                    let dir_name = path.file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    // 跳过 .system 和 dist
                    if dir_name.starts_with('.') || dir_name == "dist" {
                        continue;
                    }
                    
                    // 为每个 skill 创建远程目录并上传
                    let skill_remote = format!("{}{}/", skills_config.remote_path, dir_name);
                    let skill_config = WebDavConfig {
                        url: config.url.clone(),
                        username: config.username.clone(),
                        password: config.password.clone(),
                        remote_path: skill_remote,
                    };
                    let _ = webdav_ensure_dir(&client, &skill_config).await;
                    upload_dir_recursive(&client, &skill_config, &path, &mut result).await;
                }
            }
        }
    }
    
    Ok(result)
}

/// 递归上传目录
async fn upload_dir_recursive(client: &reqwest::Client, config: &WebDavConfig, dir: &PathBuf, result: &mut SyncResult) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            
            // 跳过 __pycache__ 等
            if name.starts_with("__") || name.starts_with('.') {
                continue;
            }
            
            if path.is_dir() {
                // 创建子目录并递归
                let sub_remote = format!("{}{}/", config.remote_path, name);
                let sub_config = WebDavConfig {
                    url: config.url.clone(),
                    username: config.username.clone(),
                    password: config.password.clone(),
                    remote_path: sub_remote,
                };
                let _ = webdav_ensure_dir(client, &sub_config).await;
                Box::pin(upload_dir_recursive(client, &sub_config, &path, result)).await;
            } else {
                // 上传文件
                if let Ok(content) = fs::read_to_string(&path) {
                    match webdav_upload(client, config, name, &content).await {
                        Ok(_) => result.uploaded.push(format!("{}{}", config.remote_path, name)),
                        Err(e) => result.errors.push(format!("{}: {}", name, e)),
                    }
                }
            }
        }
    }
}

/// 从 WebDAV 下载 Codex 配置
#[tauri::command]
async fn webdav_sync_codex_download(config: WebDavConfig, sync_config: CodexSyncConfig) -> Result<SyncResult, String> {
    let client = webdav_client()?;
    let codex_dir = get_codex_dir();
    
    let mut result = SyncResult {
        uploaded: Vec::new(),
        downloaded: Vec::new(),
        errors: Vec::new(),
    };
    
    let codex_remote_path = format!("{}codex/", config.remote_path.trim_end_matches('/'));
    let codex_config = WebDavConfig {
        url: config.url.clone(),
        username: config.username.clone(),
        password: config.password.clone(),
        remote_path: codex_remote_path.clone(),
    };
    
    // 下载 AGENTS.MD
    if sync_config.sync_agents_md {
        match webdav_download(&client, &codex_config, "AGENTS.MD").await {
            Ok(content) => {
                let agents_md = codex_dir.join("AGENTS.MD");
                match fs::write(&agents_md, &content) {
                    Ok(_) => result.downloaded.push("AGENTS.MD".to_string()),
                    Err(e) => result.errors.push(format!("AGENTS.MD: 写入失败 {}", e)),
                }
            }
            Err(e) => {
                if !e.contains("404") {
                    result.errors.push(format!("AGENTS.MD: {}", e));
                }
            }
        }
    }
    
    // 下载 prompts
    if sync_config.sync_prompts {
        let prompts_remote = format!("{}prompts/", codex_remote_path);
        let prompts_config = WebDavConfig {
            url: config.url.clone(),
            username: config.username.clone(),
            password: config.password.clone(),
            remote_path: prompts_remote,
        };
        let prompts_dir = get_prompts_dir();
        if !prompts_dir.exists() {
            let _ = fs::create_dir_all(&prompts_dir);
        }
        download_dir_recursive(&client, &prompts_config, &prompts_dir, &mut result).await;
    }
    
    // 下载 skills
    if sync_config.sync_skills {
        let skills_remote = format!("{}skills/", codex_remote_path);
        let skills_config = WebDavConfig {
            url: config.url.clone(),
            username: config.username.clone(),
            password: config.password.clone(),
            remote_path: skills_remote,
        };
        let skills_dir = get_skills_dir();
        if !skills_dir.exists() {
            let _ = fs::create_dir_all(&skills_dir);
        }
        download_dir_recursive(&client, &skills_config, &skills_dir, &mut result).await;
    }
    
    // 下载 config.toml
    if sync_config.sync_config_toml {
        match webdav_download(&client, &codex_config, "config.toml").await {
            Ok(remote_content) => {
                let config_toml = codex_dir.join("config.toml");
                match fs::write(&config_toml, &remote_content) {
                    Ok(_) => result.downloaded.push("config.toml".to_string()),
                    Err(e) => result.errors.push(format!("config.toml: 写入失败 {}", e)),
                }
            }
            Err(e) => {
                if !e.contains("404") && !e.contains("HTTP 404") {
                    result.errors.push(format!("config.toml: {}", e));
                }
            }
        }
    }
    
    Ok(result)
}

/// 递归下载目录
async fn download_dir_recursive(client: &reqwest::Client, config: &WebDavConfig, local_dir: &PathBuf, result: &mut SyncResult) {
    // 列出远程文件
    match webdav_list_all(client, config).await {
        Ok(items) => {
            for item in items {
                if item.ends_with('/') {
                    // 是目录，递归下载
                    let dir_name = item.trim_end_matches('/');
                    let sub_remote = format!("{}{}/", config.remote_path, dir_name);
                    let sub_config = WebDavConfig {
                        url: config.url.clone(),
                        username: config.username.clone(),
                        password: config.password.clone(),
                        remote_path: sub_remote,
                    };
                    let sub_local = local_dir.join(dir_name);
                    if !sub_local.exists() {
                        let _ = fs::create_dir_all(&sub_local);
                    }
                    Box::pin(download_dir_recursive(client, &sub_config, &sub_local, result)).await;
                } else {
                    // 是文件，下载
                    match webdav_download(client, config, &item).await {
                        Ok(content) => {
                            let local_path = local_dir.join(&item);
                            match fs::write(&local_path, &content) {
                                Ok(_) => result.downloaded.push(format!("{}{}", config.remote_path, item)),
                                Err(e) => result.errors.push(format!("{}: 写入失败 {}", item, e)),
                            }
                        }
                        Err(e) => result.errors.push(format!("{}: {}", item, e)),
                    }
                }
            }
        }
        Err(e) => {
            if !e.contains("404") {
                result.errors.push(format!("列目录失败: {}", e));
            }
        }
    }
}

/// 列出 WebDAV 目录中的所有文件和子目录
async fn webdav_list_all(client: &reqwest::Client, config: &WebDavConfig) -> Result<Vec<String>, String> {
    let remote_path = normalize_remote_path(&config.remote_path);
    let url = format!("{}{}", config.url.trim_end_matches('/'), remote_path);
    
    let response = client
        .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&config.username, Some(&config.password))
        .header("Depth", "1")
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(r#"<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><displayname/><resourcetype/></prop></propfind>"#)
        .send()
        .await
        .map_err(|e| format!("列目录失败: {}", e))?;
    
    let status = response.status();
    if !status.is_success() && status.as_u16() != 207 {
        return Err(format!("列目录失败: HTTP {}", status));
    }
    
    let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    
    let mut items = Vec::new();
    let href_patterns = ["<d:href>", "<D:href>", "<href>"];
    let href_end_patterns = ["</d:href>", "</D:href>", "</href>"];
    
    // 检查是否是目录
    let _is_collection = body.contains("<d:collection") || body.contains("<D:collection") || body.contains("<collection");
    
    for (start_pat, end_pat) in href_patterns.iter().zip(href_end_patterns.iter()) {
        let mut search_pos = 0;
        let mut first = true;
        while let Some(start_idx) = body[search_pos..].find(start_pat) {
            let abs_start = search_pos + start_idx + start_pat.len();
            if let Some(end_idx) = body[abs_start..].find(end_pat) {
                let href_content = &body[abs_start..abs_start + end_idx];
                let decoded = urlencoding::decode(href_content).unwrap_or_else(|_| href_content.into());
                
                // 跳过第一个（当前目录本身）
                if first {
                    first = false;
                    search_pos = abs_start + end_idx;
                    continue;
                }
                
                // 提取文件/目录名
                let name = decoded.trim_end_matches('/').rsplit('/').next().unwrap_or("");
                if !name.is_empty() && !name.starts_with('.') {
                    // 检查这个 href 后面是否有 collection 标记
                    let check_range = &body[abs_start..body.len().min(abs_start + 500)];
                    let is_dir = check_range.contains("<d:collection") || 
                                 check_range.contains("<D:collection") ||
                                 check_range.contains("<collection");
                    
                    let item_name = if is_dir && !decoded.ends_with('/') {
                        format!("{}/", name)
                    } else if decoded.ends_with('/') {
                        format!("{}/", name)
                    } else {
                        name.to_string()
                    };
                    
                    if !items.contains(&item_name) {
                        items.push(item_name);
                    }
                }
                search_pos = abs_start + end_idx;
            } else {
                break;
            }
        }
    }
    
    Ok(items)
}

// ========== Token 刷新 ==========

/// Token 刷新请求结构
#[derive(Debug, Serialize)]
struct TokenRefreshRequest {
    client_id: &'static str,
    grant_type: &'static str,
    refresh_token: String,
    scope: &'static str,
}

/// Token 刷新响应结构
#[derive(Debug, Deserialize)]
struct TokenRefreshResponse {
    id_token: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
}

/// Codex CLI 使用的 Client ID（公开的）
const CODEX_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_REFRESH_URL: &str = "https://auth.openai.com/oauth/token";

/// 刷新指定账号的 Token
#[tauri::command]
async fn refresh_account_token(file_path: String) -> Result<String, String> {
    // 读取认证文件
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取认证文件失败: {}", e))?;
    
    let auth: CodexAuthFile = serde_json::from_str(&content)
        .map_err(|e| format!("解析认证文件失败: {}", e))?;
    
    let refresh_token = &auth.tokens.refresh_token;
    
    // 构建刷新请求
    let refresh_request = TokenRefreshRequest {
        client_id: CODEX_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refresh_token.clone(),
        scope: "openid profile email",
    };
    
    println!("[Token Refresh] 开始刷新 Token...");
    println!("[Token Refresh] URL: {}", TOKEN_REFRESH_URL);
    
    // 发送刷新请求
    let client = reqwest::Client::new();
    let response = client
        .post(TOKEN_REFRESH_URL)
        .header("Content-Type", "application/json")
        .json(&refresh_request)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    println!("[Token Refresh] 响应状态: {}", status);
    
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        println!("[Token Refresh] 错误响应: {}", body);
        
        // 解析错误信息
        if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&body) {
            if let Some(error) = error_json.get("error") {
                let error_code = error.get("code")
                    .or_else(|| error_json.get("code"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                
                return match error_code {
                    "refresh_token_expired" => Err("Refresh Token 已过期，请重新登录 Codex CLI".to_string()),
                    "refresh_token_reused" => Err("Refresh Token 已被使用，请重新登录 Codex CLI".to_string()),
                    "refresh_token_invalidated" => Err("Refresh Token 已被撤销，请重新登录 Codex CLI".to_string()),
                    _ => Err(format!("刷新失败: {} - {}", status, body)),
                };
            }
        }
        
        return Err(format!("刷新失败: HTTP {} - {}", status, body));
    }
    
    // 解析响应
    let refresh_response: TokenRefreshResponse = response.json().await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    println!("[Token Refresh] 刷新成功!");
    println!("[Token Refresh] 新 access_token: {}...", 
        refresh_response.access_token.as_ref().map(|t| &t[..20.min(t.len())]).unwrap_or("无"));
    println!("[Token Refresh] 新 id_token: {}...", 
        refresh_response.id_token.as_ref().map(|t| &t[..20.min(t.len())]).unwrap_or("无"));
    println!("[Token Refresh] 新 refresh_token: {}...", 
        refresh_response.refresh_token.as_ref().map(|t| &t[..20.min(t.len())]).unwrap_or("无"));
    
    // 更新认证文件
    let mut updated_auth = auth.clone();
    
    if let Some(new_access_token) = refresh_response.access_token {
        updated_auth.tokens.access_token = new_access_token;
    }
    if let Some(new_id_token) = refresh_response.id_token {
        updated_auth.tokens.id_token = new_id_token;
    }
    if let Some(new_refresh_token) = refresh_response.refresh_token {
        updated_auth.tokens.refresh_token = new_refresh_token;
    }
    
    // 更新 last_refresh 时间
    updated_auth.last_refresh = chrono::Utc::now().to_rfc3339();
    
    // 写回文件
    let updated_content = serde_json::to_string_pretty(&updated_auth)
        .map_err(|e| format!("序列化失败: {}", e))?;
    
    fs::write(&file_path, &updated_content)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    println!("[Token Refresh] 已更新认证文件: {}", file_path);
    
    Ok("Token 刷新成功".to_string())
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
                .show_menu_on_left_click(false)
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
            webdav_test_connection,
            // Prompts & Skills
            scan_prompts,
            scan_skills,
            read_prompt_content,
            save_prompt_content,
            create_prompt,
            delete_prompt,
            read_skill_content,
            save_skill_content,
            create_skill,
            delete_skill,
            read_agents_md,
            save_agents_md,
            read_config_toml,
            save_config_toml,
            open_codex_dir,
            webdav_sync_codex_upload,
            webdav_sync_codex_download,
            refresh_account_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
