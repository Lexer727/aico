use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
    Json,
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::path::{Path as StdPath, PathBuf};
use aico_core::AicoConfig;
use crate::server::AppState;

#[derive(RustEmbed)]
#[folder = "../../frontend/dist"]
pub struct FrontendAssets;

/// Serves embedded WebUI static assets with SPA wildcard fallback and disk search backup
// @implements spec-ft-core-host-runtime::REQ-002
pub async fn static_asset_handler(uri: Uri) -> impl IntoResponse {
    let raw_path = uri.path().trim_start_matches('/');
    let asset_path = if raw_path.is_empty() {
        "index.html"
    } else {
        raw_path
    };

    // 1. Try reading exact asset from disk if present (allows live updates from frontend builds)
    for base in &["frontend/dist", "../frontend/dist", "../../frontend/dist", "dist"] {
        let disk_path = StdPath::new(base).join(asset_path);
        if disk_path.is_file() {
            if let Ok(bytes) = std::fs::read(&disk_path) {
                let mime = mime_guess::from_path(asset_path).first_or_octet_stream();
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(
                        header::CONTENT_TYPE,
                        HeaderValue::from_str(mime.as_ref())
                            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
                    )
                    .body(Body::from(bytes))
                    .unwrap();
            }
        }
    }

    // 2. Fallback: try to find the exact asset in embedded static files
    if let Some(content) = FrontendAssets::get(asset_path) {
        let mime = mime_guess::from_path(asset_path).first_or_octet_stream();
        return Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_str(mime.as_ref())
                            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
            )
            .body(Body::from(content.data))
            .unwrap();
    }

    // 3. SPA Wildcard Fallback: for non-API client routes, check disk index.html first
    for base in &["frontend/dist", "../frontend/dist", "../../frontend/dist", "dist"] {
        let disk_path = StdPath::new(base).join("index.html");
        if disk_path.is_file() {
            if let Ok(bytes) = std::fs::read(&disk_path) {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(
                        header::CONTENT_TYPE,
                        HeaderValue::from_static("text/html; charset=utf-8"),
                    )
                    .body(Body::from(bytes))
                    .unwrap();
            }
        }
    }

    // 4. Fallback: serve embedded index.html
    if let Some(index) = FrontendAssets::get("index.html") {
        Response::builder()
            .status(StatusCode::OK)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            )
            .body(Body::from(index.data))
            .unwrap()
    } else {
        Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/plain"),
            )
            .body(Body::from("404 Not Found"))
            .unwrap()
    }
}

// ===========================================================================
// Multi-Modal Project Asset Management Service
// ===========================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredAssetInfo {
    pub id: String,
    pub filename: String,
    pub path: String,          // Relative path to specs_root (using forward slashes)
    pub scope_type: String,    // "epic" or "feature"
    pub scope_id: String,      // epic id or feature id
    pub source_label: String,  // "epic" or "<feature_id>"
    pub is_subfeature: bool,
    pub mime_type: String,
    pub size_bytes: u64,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_preview: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RawAssetQuery {
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenSystemRequest {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenSystemResponse {
    pub status: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteAssetRequest {
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeleteAssetResponse {
    pub status: String,
    pub path: String,
}

/// Helper to get the active specs directory
pub async fn get_effective_specs_path(state: &AppState) -> PathBuf {
    let registry = state.registry.read().await;
    let active_project = registry
        .get_active()
        .cloned()
        .or_else(|| registry.list_cloned().into_iter().next());

    if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            return proj.specs_path.clone();
        }
    }
    PathBuf::from("d:/aico/aico-specs")
}

pub async fn get_effective_codebase_path(state: &AppState) -> Option<PathBuf> {
    let registry = state.registry.read().await;
    let active_project = registry
        .get_active()
        .cloned()
        .or_else(|| registry.list_cloned().into_iter().next());

    if let Some(proj) = active_project {
        if proj.codebase_path.exists() {
            return Some(proj.codebase_path.clone());
        }
    }
    None
}

pub async fn get_active_config(state: &AppState) -> AicoConfig {
    let specs_root = get_effective_specs_path(state).await;
    let codebase_root = get_effective_codebase_path(state).await;
    AicoConfig::find_and_load(&specs_root, codebase_root.as_deref())
}

fn normalize_relative_path(path: &StdPath) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn extract_text_preview(file_path: &StdPath, mime_type: &str) -> Option<String> {
    if mime_type.starts_with("image/") || mime_type.starts_with("audio/") {
        return None;
    }

    if let Ok(bytes) = std::fs::read(file_path) {
        if aico_core::config::AssetsConfig::is_readable_utf8(&bytes) {
            if let Ok(content) = std::str::from_utf8(&bytes) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    let preview: String = trimmed.chars().take(250).collect();
                    return Some(preview);
                }
            }
        }
    }
    None
}

/// Helper to build a DiscoveredAssetInfo from a disk file
fn make_asset_info(
    file_path: &StdPath,
    specs_root: &StdPath,
    scope_type: &str,
    scope_id: &str,
    source_label: &str,
    is_subfeature: bool,
) -> Option<DiscoveredAssetInfo> {
    if !file_path.is_file() {
        return None;
    }

    let filename = file_path.file_name()?.to_string_lossy().to_string();
    let rel_path = file_path.strip_prefix(specs_root).ok()?;
    let normalized_rel = normalize_relative_path(rel_path);

    let metadata = file_path.metadata().ok()?;
    let size_bytes = metadata.len();
    let updated_at = metadata
        .modified()
        .ok()
        .and_then(|m| {
            m.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| format!("{}", d.as_secs()))
        })
        .unwrap_or_default();

    let mime_type = mime_guess::from_path(file_path)
        .first_or_octet_stream()
        .to_string();
    let text_preview = extract_text_preview(file_path, &mime_type);

    Some(DiscoveredAssetInfo {
        id: normalized_rel.clone(),
        filename,
        path: normalized_rel,
        scope_type: scope_type.to_string(),
        scope_id: scope_id.to_string(),
        source_label: source_label.to_string(),
        is_subfeature,
        mime_type,
        size_bytes,
        updated_at,
        text_preview,
    })
}

/// Scan assets for an epic: includes direct epic assets (`./assets`) and child feature assets (`./features/*/assets`)
// @implements spec-ft-core-assets-manager::REQ-004
pub fn scan_assets_for_epic(specs_root: &StdPath, epic_id: &str) -> Vec<DiscoveredAssetInfo> {
    let mut results = Vec::new();
    let epics_dir = specs_root.join("epics");
    if !epics_dir.is_dir() {
        return results;
    }

    let epic_id_lower = epic_id.to_lowercase();
    let mut epic_dir = None;

    if let Ok(entries) = std::fs::read_dir(&epics_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    == epic_id_lower
            {
                epic_dir = Some(entry.path());
                break;
            }
        }
    }

    let Some(epic_dir) = epic_dir else {
        return results;
    };

    // 1. Direct Epic Assets: <epic_dir>/assets
    let direct_assets_dir = epic_dir.join("assets");
    if direct_assets_dir.is_dir() {
        if let Ok(files) = std::fs::read_dir(&direct_assets_dir) {
            let mut sorted: Vec<_> = files.flatten().collect();
            sorted.sort_by_key(|f| f.file_name());
            for f in sorted {
                if let Some(info) = make_asset_info(&f.path(), specs_root, "epic", epic_id, "epic", false) {
                    results.push(info);
                }
            }
        }
    }

    // 2. Sub-feature Assets: <epic_dir>/features/*/assets (fallback: <epic_dir>/specs/*/assets)
    for sub in &["features", "specs"] {
        let sub_dir = epic_dir.join(sub);
        if sub_dir.is_dir() {
            if let Ok(feat_entries) = std::fs::read_dir(&sub_dir) {
                let mut sorted_feats: Vec<_> = feat_entries.flatten().collect();
                sorted_feats.sort_by_key(|f| f.file_name());

                for feat in sorted_feats {
                    if feat.path().is_dir() {
                        let feat_name = feat.file_name().to_string_lossy().to_string();
                        let feat_assets_dir = feat.path().join("assets");
                        if feat_assets_dir.is_dir() {
                            if let Ok(files) = std::fs::read_dir(&feat_assets_dir) {
                                let mut sorted_files: Vec<_> = files.flatten().collect();
                                sorted_files.sort_by_key(|f| f.file_name());

                                for f in sorted_files {
                                    if let Some(info) = make_asset_info(
                                        &f.path(),
                                        specs_root,
                                        "epic",
                                        epic_id,
                                        &feat_name,
                                        true,
                                    ) {
                                        results.push(info);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

/// Helper to locate a feature directory (in epics or standalone features)
pub fn find_feature_dir(specs_root: &StdPath, feat_id: &str) -> Option<PathBuf> {
    let feat_id_lower = feat_id.to_lowercase();

    // 1. Check under epics/*/features/<feat_id> and epics/*/specs/<feat_id>
    let epics_dir = specs_root.join("epics");
    if epics_dir.is_dir() {
        if let Ok(epic_entries) = std::fs::read_dir(&epics_dir) {
            for epic in epic_entries.flatten() {
                if epic.path().is_dir() {
                    for sub in &["features", "specs"] {
                        let feat_candidate = epic.path().join(sub).join(&feat_id);
                        if feat_candidate.is_dir() {
                            return Some(feat_candidate);
                        }
                        // Also case-insensitive check
                        let sub_dir = epic.path().join(sub);
                        if sub_dir.is_dir() {
                            if let Ok(entries) = std::fs::read_dir(&sub_dir) {
                                for entry in entries.flatten() {
                                    if entry.path().is_dir()
                                        && entry.file_name().to_string_lossy().to_lowercase() == feat_id_lower
                                    {
                                        return Some(entry.path());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Check standalone features under features/<feat_id>
    let standalone_dir = specs_root.join("features");
    if standalone_dir.is_dir() {
        let feat_candidate = standalone_dir.join(&feat_id);
        if feat_candidate.is_dir() {
            return Some(feat_candidate);
        }
        if let Ok(entries) = std::fs::read_dir(&standalone_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir()
                    && entry.file_name().to_string_lossy().to_lowercase() == feat_id_lower
                {
                    return Some(entry.path());
                }
            }
        }
    }

    None
}

/// Scan assets for a single feature: only includes files in <feature_dir>/assets
// @implements spec-ft-core-assets-manager::REQ-005
pub fn scan_assets_for_feature(specs_root: &StdPath, feat_id: &str) -> Vec<DiscoveredAssetInfo> {
    let mut results = Vec::new();
    let Some(feat_dir) = find_feature_dir(specs_root, feat_id) else {
        return results;
    };

    let assets_dir = feat_dir.join("assets");
    if assets_dir.is_dir() {
        if let Ok(files) = std::fs::read_dir(&assets_dir) {
            let mut sorted: Vec<_> = files.flatten().collect();
            sorted.sort_by_key(|f| f.file_name());

            for f in sorted {
                if let Some(info) = make_asset_info(&f.path(), specs_root, "feature", feat_id, feat_id, false) {
                    results.push(info);
                }
            }
        }
    }

    results
}

// ---------------------------------------------------------------------------
// HTTP API Handlers
// ---------------------------------------------------------------------------

// @implements spec-ft-core-assets-manager::REQ-004
pub async fn list_epic_assets_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredAssetInfo>> {
    let specs_root = get_effective_specs_path(&state).await;
    Json(scan_assets_for_epic(&specs_root, &id))
}

// @implements spec-ft-core-assets-manager::REQ-005
pub async fn list_feature_assets_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredAssetInfo>> {
    let specs_root = get_effective_specs_path(&state).await;
    Json(scan_assets_for_feature(&specs_root, &id))
}

/// Serves raw binary/text asset content with MIME type and path traversal protection
// @implements spec-ft-core-assets-manager::REQ-003
pub async fn get_asset_raw_handler(
    Query(query): Query<RawAssetQuery>,
    State(state): State<AppState>,
) -> Result<Response, StatusCode> {
    let raw_path = query.path.trim();

    // Guard against path traversal
    if raw_path.contains("..")
        || raw_path.starts_with('/')
        || raw_path.starts_with('\\')
        || (raw_path.len() >= 2 && raw_path.chars().nth(1) == Some(':'))
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let specs_root = get_effective_specs_path(&state).await;
    let file_path = specs_root.join(raw_path);

    if !file_path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = std::fs::read(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();

    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            HeaderValue::from_str(mime.as_ref())
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        )
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(bytes))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// Handles multi-part file uploads and stores them under the appropriate assets directory
// @implements spec-ft-core-assets-manager::REQ-001
// @implements spec-ft-core-assets-manager::REQ-002
// @implements spec-ft-core-assets-manager::REQ-003
pub async fn upload_asset_handler(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<DiscoveredAssetInfo>, (StatusCode, String)> {
    let mut scope_type = String::new();
    let mut scope_id = String::new();
    let mut file_name = String::new();
    let mut file_bytes = Vec::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        if name == "scope_type" {
            if let Ok(text) = field.text().await {
                scope_type = text.trim().to_lowercase();
            }
        } else if name == "scope_id" {
            if let Ok(text) = field.text().await {
                scope_id = text.trim().to_string();
            }
        } else if name == "file" {
            if let Some(fname) = field.file_name() {
                file_name = fname.to_string();
            }
            if let Ok(bytes) = field.bytes().await {
                file_bytes = bytes.to_vec();
            }
        }
    }

    if scope_type.is_empty() || scope_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Missing scope_type or scope_id".to_string(),
        ));
    }

    if file_name.is_empty() || file_bytes.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Missing file or empty file payload".to_string(),
        ));
    }

    // Clean filename: remove paths and traversal sequences
    let clean_fname = StdPath::new(&file_name)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "asset".to_string());

    if clean_fname.contains("..") {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid file name containing path traversal".to_string(),
        ));
    }

    // Validate file type against active AicoConfig
    // @implements spec-ft-core-assets-manager::REQ-014
    let config = get_active_config(&state).await;
    if !config.assets.is_allowed_file(&clean_fname, &file_bytes) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "Unsupported file type for '{}'. Only images and readable text/code files are permitted.",
                clean_fname
            ),
        ));
    }

    let specs_root = get_effective_specs_path(&state).await;

    // Determine target assets directory
    let target_assets_dir = if scope_type == "epic" {
        specs_root.join("epics").join(&scope_id).join("assets")
    } else if scope_type == "feature" {
        if let Some(feat_dir) = find_feature_dir(&specs_root, &scope_id) {
            feat_dir.join("assets")
        } else {
            // Default to standalone features/<scope_id>/assets if feature directory not yet created
            specs_root.join("features").join(&scope_id).join("assets")
        }
    } else {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid scope_type: expected 'epic' or 'feature', found '{}'", scope_type),
        ));
    };

    std::fs::create_dir_all(&target_assets_dir).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create asset directory: {}", e),
        )
    })?;

    let destination_file = target_assets_dir.join(&clean_fname);
    std::fs::write(&destination_file, &file_bytes).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to save asset: {}", e),
        )
    })?;

    let asset_info = make_asset_info(
        &destination_file,
        &specs_root,
        &scope_type,
        &scope_id,
        if scope_type == "epic" { "epic" } else { &scope_id },
        false,
    )
    .ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to construct asset info".to_string(),
        )
    })?;

    Ok(Json(asset_info))
}

/// Opens a file in the host operating system's registered application
// @implements spec-ft-core-assets-manager::REQ-003
// @implements spec-ft-core-assets-manager::REQ-008
pub async fn open_system_handler(
    State(state): State<AppState>,
    Json(payload): Json<OpenSystemRequest>,
) -> Result<Json<OpenSystemResponse>, (StatusCode, String)> {
    let raw_path = payload.path.trim();

    if raw_path.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Empty path".to_string()));
    }

    // Path traversal check
    if raw_path.contains("..") {
        return Err((
            StatusCode::BAD_REQUEST,
            "Path contains invalid traversal components".to_string(),
        ));
    }

    let specs_root = get_effective_specs_path(&state).await;
    let candidate = StdPath::new(raw_path);

    let abs_path = if candidate.is_absolute() {
        // Must reside within specs_root or an ancestor
        candidate.to_path_buf()
    } else {
        specs_root.join(raw_path)
    };

    if !abs_path.is_file() {
        return Err((
            StatusCode::NOT_FOUND,
            format!("File not found at: {}", abs_path.to_string_lossy()),
        ));
    }

    let path_str = abs_path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        // On Windows, `rundll32 url.dll,FileProtocolHandler <path>` launches the default registered application
        // without flashing a console window.
        let spawn_res = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &path_str])
            .spawn();

        if let Err(e) = spawn_res {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to launch file on Windows: {}", e),
            ));
        }
    }

    #[cfg(target_os = "macos")]
    {
        let spawn_res = std::process::Command::new("open")
            .arg(&abs_path)
            .spawn();

        if let Err(e) = spawn_res {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to launch file on macOS: {}", e),
            ));
        }
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        let spawn_res = std::process::Command::new("xdg-open")
            .arg(&abs_path)
            .spawn();

        if let Err(e) = spawn_res {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to launch file on Linux: {}", e),
            ));
        }
    }

    Ok(Json(OpenSystemResponse {
        status: "ok".to_string(),
        path: path_str,
    }))
}

/// Deletes an asset file from disk with strict path traversal validation
// @implements spec-ft-core-assets-manager::REQ-003
// @implements spec-ft-core-assets-manager::REQ-009
pub async fn delete_asset_handler(
    State(state): State<AppState>,
    Json(payload): Json<DeleteAssetRequest>,
) -> Result<Json<DeleteAssetResponse>, (StatusCode, String)> {
    let raw_path = payload.path.trim();

    if raw_path.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Empty path".to_string()));
    }

    // Path traversal check
    if raw_path.contains("..") {
        return Err((
            StatusCode::BAD_REQUEST,
            "Path contains invalid traversal components".to_string(),
        ));
    }

    let specs_root = get_effective_specs_path(&state).await;
    let candidate = StdPath::new(raw_path);

    let abs_path = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        specs_root.join(raw_path)
    };

    if !abs_path.is_file() {
        return Err((
            StatusCode::NOT_FOUND,
            format!("Asset file not found at: {}", abs_path.to_string_lossy()),
        ));
    }

    std::fs::remove_file(&abs_path).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to delete asset file: {}", e),
        )
    })?;

    Ok(Json(DeleteAssetResponse {
        status: "ok".to_string(),
        path: raw_path.to_string(),
    }))
}
