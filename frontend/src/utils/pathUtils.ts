// @implements ft-core-workspace-path-normalization::TASK-CORE-014-2::REQ-005
// @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-3::REQ-005
// @implements ft-core-multirepo-code-path-normalization::TASK-CORE-016-3::REQ-004
export function normalizeWorkspacePath(file: string): string {
  if (!file) return file;
  let normalized = file.replace(/\\/g, '/');

  // Dynamic Anchor: strip any arbitrary root path up to and including "/codebase/"
  const codebaseIdx = normalized.indexOf('/codebase/');
  if (codebaseIdx !== -1) {
    normalized = normalized.slice(codebaseIdx + '/codebase/'.length);
  } else if (normalized.startsWith('codebase/')) {
    normalized = normalized.slice('codebase/'.length);
  }

  // Also strip any specs root prefix dynamically if an absolute path was passed
  const specsMatch = normalized.match(/\/([^/]+-specs\/.*)$/);
  if (specsMatch) {
    normalized = specsMatch[1];
  }

  return normalized.replace(/^\/+/, '');
}
