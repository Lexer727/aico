use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;
use std::path::Path;

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
        let disk_path = Path::new(base).join(asset_path);
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
        let disk_path = Path::new(base).join("index.html");
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
