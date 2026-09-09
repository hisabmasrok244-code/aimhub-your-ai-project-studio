// Shared, browser-safe types for AimHub.

export type Visibility = "private" | "public";

export type BuildStatus = "queued" | "running" | "success" | "failed" | "cancelled";

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  build_type: string;
  default_branch: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  is_dir: boolean;
  is_binary: boolean;
  content: string;
  size: number;
  updated_at: string;
}

export interface Build {
  id: string;
  project_id: string;
  number: number;
  status: string;
  provider: string;
  trigger: string;
  external_id: string | null;
  artifact_url: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface BuildLogLine {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

export type FileChangeAction = "create" | "update" | "delete" | "move";

export interface FileChange {
  action: FileChangeAction;
  path: string;
  to?: string;
  content?: string;
}

export interface AiProposal {
  id: string;
  project_id: string;
  summary: string;
  changes: FileChange[];
  status: string;
  created_at: string;
}

export interface AiMessage {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AiSettingsView {
  provider: string;
  base_url: string;
  model: string;
  has_api_key: boolean;
}
