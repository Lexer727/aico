use axum::{
    body::Body,
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../frontend/dist"]
pub struct FrontendAssets;

/// Serves embedded WebUI static assets with SPA wildcard fallback
// @implements spec-ft-core-host-runtime::REQ-002
pub async fn static_asset_handler(uri: Uri) -> impl IntoResponse {
    let raw_path = uri.path().trim_start_matches('/');
    let asset_path = if raw_path.is_empty() {
        "index.html"
    } else {
        raw_path
    };

    // 1. Try to find the exact asset in embedded static files
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

    // 2. SPA Wildcard Fallback: for non-API client routes, serve index.html
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
