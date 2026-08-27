export type TinyFile = {
  path: string;
  contents: string;
};

export type TinyCommit = {
  id: string;
  message: string;
  branch: string;
  parent: string;
  files: TinyFile[];
  createdAt: string;
};

type TinySnapshot = {
  branch: string;
  files: TinyFile[];
  commits: TinyCommit[];
  branches: Record<string, string>;
};

export class TinyGit {
  private branchName: string;
  private files: Map<string, string>;
  private commits: TinyCommit[];
  private branches: Record<string, string>;

  constructor(initialFiles: TinyFile[] = []) {
    this.branchName = "main";
    this.files = new Map(initialFiles.map((file) => [file.path, file.contents]));
    this.commits = [];
    this.branches = { main: "" };
  }

  get branch(): string {
    return this.branchName;
  }

  get stagedFiles(): TinyFile[] {
    return [...this.files.entries()].map(([path, contents]) => ({ path, contents }));
  }

  get log(): TinyCommit[] {
    return [...this.commits].reverse();
  }

  get branchesList(): string[] {
    return Object.keys(this.branches).sort();
  }

  get head(): string {
    return this.branches[this.branchName] ?? "";
  }

  get hasChanges(): boolean {
    const head = this.commits.find((commit) => commit.id === this.head);
    if (!head) return this.files.size > 0;
    if (head.files.length !== this.files.size) return true;
    return head.files.some((file) => this.files.get(file.path) !== file.contents);
  }

  stage(file: TinyFile): void {
    this.files.set(file.path, file.contents);
  }

  remove(path: string): boolean {
    return this.files.delete(path);
  }

  commit(message: string): TinyCommit | null {
    const cleanMessage = message.trim();
    if (!cleanMessage || !this.hasChanges) return null;

    const commit: TinyCommit = {
      id: `m${String(this.commits.length + 1).padStart(3, "0")}`,
      message: cleanMessage,
      branch: this.branchName,
      parent: this.head,
      files: this.stagedFiles,
      createdAt: new Date().toISOString(),
    };
    this.commits.push(commit);
    this.branches[this.branchName] = commit.id;
    return commit;
  }

  createBranch(name: string): boolean {
    const cleanName = name.trim();
    if (!cleanName || this.branches[cleanName] !== undefined) return false;
    this.branches[cleanName] = this.branches[this.branchName] ?? "";
    return true;
  }

  checkout(name: string): boolean {
    if (this.branches[name] === undefined) return false;
    if (name !== this.branchName && this.hasChanges) return false;
    this.branchName = name;
    const head = this.commits.find((commit) => commit.id === this.head);
    this.files = new Map(head?.files.map((file) => [file.path, file.contents]) ?? []);
    return true;
  }

  snapshot(): string {
    const value: TinySnapshot = {
      branch: this.branchName,
      files: this.stagedFiles,
      commits: this.commits,
      branches: this.branches,
    };
    return JSON.stringify(value);
  }

  static restore(snapshot: string | null, fallback: TinyFile[] = []): TinyGit {
    if (!snapshot) return new TinyGit(fallback);
    try {
      const value = JSON.parse(snapshot) as TinySnapshot;
      const git = new TinyGit(value.files);
      git.branchName = value.branch || "main";
      git.commits = value.commits ?? [];
      git.branches = value.branches ?? { main: "" };
      return git;
    } catch {
      return new TinyGit(fallback);
    }
  }
}
