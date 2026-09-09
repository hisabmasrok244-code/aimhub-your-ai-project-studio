import type { ProjectFile } from "./types";

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  file?: ProjectFile;
  children: TreeNode[];
}

export function normalizePath(input: string): string {
  const parts = input
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p.length > 0 && p !== ".");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

export function dirName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function baseName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  const index = new Map<string, TreeNode>([["", root]]);

  const ensureDir = (path: string): TreeNode => {
    const existing = index.get(path);
    if (existing) return existing;
    const parent = ensureDir(dirName(path));
    const node: TreeNode = { name: baseName(path), path, isDir: true, children: [] };
    parent.children.push(node);
    index.set(path, node);
    return node;
  };

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    if (file.is_dir) {
      ensureDir(file.path).file = file;
      continue;
    }
    const parent = ensureDir(dirName(file.path));
    const node: TreeNode = {
      name: baseName(file.path),
      path: file.path,
      isDir: false,
      file,
      children: [],
    };
    parent.children.push(node);
    index.set(file.path, node);
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    );
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(root.children);
  return root.children;
}

export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    kt: "Kotlin",
    java: "Java",
    xml: "XML",
    gradle: "Gradle",
    kts: "Gradle KTS",
    json: "JSON",
    md: "Markdown",
    yml: "YAML",
    yaml: "YAML",
    py: "Python",
    css: "CSS",
    html: "HTML",
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : "نص");
}

export function isProbablyBinary(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|ico|pdf|zip|jar|apk|aab|so|ttf|otf|woff2?|mp[34]|wav|keystore|jks)$/i.test(
    name,
  );
}
