use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// @implements spec-ft-core-assets-manager::REQ-013
// @implements spec-ft-core-assets-manager::REQ-014
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AssetsConfig {
    #[serde(default = "default_allow_utf8_fallback")]
    pub allow_utf8_text_fallback: bool,
    #[serde(default = "default_image_extensions")]
    pub allowed_image_extensions: Vec<String>,
    #[serde(default = "default_text_extensions")]
    pub allowed_text_extensions: Vec<String>,
}

fn default_allow_utf8_fallback() -> bool {
    true
}

fn default_image_extensions() -> Vec<String> {
    vec![
        "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif", "bmp",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

fn default_text_extensions() -> Vec<String> {
    vec![
        "txt", "md", "markdown", "mdx", "html", "htm", "css", "scss", "less",
        "json", "jsonc", "jsonl", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
        "xml", "csv", "tsv", "sql", "graphql", "proto", "log",
        "py", "pyi", "ipynb", "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs",
        "go", "java", "kt", "c", "h", "cpp", "hpp", "cs", "rb", "php", "swift",
        "scala", "r", "lua", "sh", "bash", "zsh", "ps1", "bat", "cmd",
        "dockerfile", "makefile", "vue", "svelte", "astro", "dart", "zig", "sol", "tf",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

impl Default for AssetsConfig {
    fn default() -> Self {
        Self {
            allow_utf8_text_fallback: default_allow_utf8_fallback(),
            allowed_image_extensions: default_image_extensions(),
            allowed_text_extensions: default_text_extensions(),
        }
    }
}

impl AssetsConfig {
    pub fn is_allowed_file(&self, filename: &str, content: &[u8]) -> bool {
        let ext = Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        if self.allowed_image_extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext)) {
            return true;
        }

        if self.allowed_text_extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext)) {
            return true;
        }

        // Extensionless special files like Dockerfile or Makefile
        let lower_name = filename.to_lowercase();
        if self.allowed_text_extensions.iter().any(|e| e.eq_ignore_ascii_case(&lower_name)) {
            return true;
        }

        if self.allow_utf8_text_fallback {
            return Self::is_readable_utf8(content);
        }

        false
    }

    pub fn is_image_file(&self, filename: &str) -> bool {
        let ext = Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        self.allowed_image_extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext))
    }

    pub fn is_text_or_code_file(&self, filename: &str, content: Option<&[u8]>) -> bool {
        let ext = Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        if self.allowed_text_extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext)) {
            return true;
        }

        let lower_name = filename.to_lowercase();
        if self.allowed_text_extensions.iter().any(|e| e.eq_ignore_ascii_case(&lower_name)) {
            return true;
        }

        if let Some(bytes) = content {
            if self.allow_utf8_text_fallback {
                return Self::is_readable_utf8(bytes);
            }
        }

        false
    }

    pub fn is_readable_utf8(content: &[u8]) -> bool {
        if content.is_empty() {
            return true;
        }
        if content.contains(&0) {
            return false;
        }
        std::str::from_utf8(content).is_ok()
    }
}

// @implements spec-ft-core-assets-manager::REQ-013
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct AicoConfig {
    #[serde(default)]
    pub assets: AssetsConfig,
}

impl AicoConfig {
    pub fn load_from_paths<P: AsRef<Path>>(paths: &[P]) -> Self {
        for p in paths {
            let path = p.as_ref();
            if path.is_file() {
                if let Ok(content) = std::fs::read_to_string(path) {
                    if let Ok(config) = serde_json::from_str::<AicoConfig>(&content) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    pub fn find_and_load(specs_root: &Path, codebase_root: Option<&Path>) -> Self {
        let mut candidates = Vec::new();
        candidates.push(specs_root.join("aico.config.json"));
        if let Some(code_root) = codebase_root {
            candidates.push(code_root.join("aico.config.json"));
        }
        candidates.push(PathBuf::from("aico.config.json"));
        candidates.push(PathBuf::from("../aico.config.json"));
        candidates.push(PathBuf::from("../../aico.config.json"));

        Self::load_from_paths(&candidates)
    }
}
