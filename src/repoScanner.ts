/**
 * Repository Scanner
 * 
 * Scans a repository to extract metadata including:
 * - Language detection
 * - Build system identification
 * - Configuration files
 * - Directory structure
 * - Dependencies
 * - Entry points
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, basename, relative } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as ignoreModule from 'ignore';
import type { Ignore } from 'ignore';

// Handle both ESM and CJS module resolution
const ignore = ((ignoreModule as unknown as { default?: unknown }).default || ignoreModule) as unknown as (options?: { ignorecase?: boolean }) => Ignore;
import type {
  RepoMetadata,
  LanguageInfo,
  BuildFile,
  ConfigFile,
  DirectoryNode,
  DependencyInfo,
  GitInfo,
} from './types.js';

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.cs': 'C#',
  '.fs': 'F#',
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C/C++',
  '.hpp': 'C++',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.ps1': 'PowerShell',
  '.bicep': 'Bicep',
  '.tf': 'Terraform',
};

const BUILD_FILES: Record<string, BuildFile['type']> = {
  'package.json': 'npm',
  'yarn.lock': 'yarn',
  'pnpm-lock.yaml': 'pnpm',
  '*.csproj': 'dotnet',
  '*.fsproj': 'dotnet',
  '*.sln': 'dotnet',
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'build.gradle.kts': 'gradle',
  'Makefile': 'make',
  'Cargo.toml': 'cargo',
  'go.mod': 'go',
  'requirements.txt': 'pip',
  'pyproject.toml': 'pip',
  'Pipfile': 'pip',
};

const CONFIG_PATTERNS: Record<string, ConfigFile['type']> = {
  '.env': 'env',
  '.env.example': 'env',
  '.env.local': 'env',
  'Dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'azure-pipelines.yml': 'ci',
  '.gitlab-ci.yml': 'ci',
  'Jenkinsfile': 'ci',
  '.editorconfig': 'editor',
  '.prettierrc': 'linter',
  '.eslintrc': 'linter',
  'tsconfig.json': 'other',
  'jest.config': 'other',
  'vitest.config': 'other',
};

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  '.vs',
  '.vscode',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'target',
  'vendor',
  'coverage',
  '.next',
  '.nuxt',
]);

export class RepoScanner {
  private repoPath: string;
  private ignoreFilter: Ignore | null = null;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  /**
   * Initialize the ignore filter from .gitignore
   */
  private async initIgnoreFilter(): Promise<void> {
    const gitignorePath = join(this.repoPath, '.gitignore');
    this.ignoreFilter = ignore();
    
    // Add default ignores
    this.ignoreFilter.add([...IGNORED_DIRS].map(d => `${d}/`));
    
    if (existsSync(gitignorePath)) {
      const content = await readFile(gitignorePath, 'utf-8');
      this.ignoreFilter.add(content);
    }
  }

  /**
   * Check if a path should be ignored
   */
  private shouldIgnore(relativePath: string): boolean {
    if (!this.ignoreFilter) return false;
    return this.ignoreFilter.ignores(relativePath);
  }

  /**
   * Scan the repository and return metadata
   */
  async scan(): Promise<RepoMetadata> {
    await this.initIgnoreFilter();

    const [structure, languageStats, buildFiles, configFiles, gitInfo] = await Promise.all([
      this.scanDirectory(this.repoPath),
      this.detectLanguages(),
      this.findBuildFiles(),
      this.findConfigFiles(),
      this.getGitInfo(),
    ]);

    const dependencies = await this.extractDependencies(buildFiles);
    const entryPoints = this.findEntryPoints(structure, buildFiles);
    const testFrameworks = this.detectTestFrameworks(buildFiles, structure);

    return {
      name: basename(this.repoPath),
      path: this.repoPath,
      languages: languageStats,
      buildFiles,
      configFiles,
      structure,
      dependencies,
      entryPoints,
      testFrameworks,
      gitInfo,
    };
  }

  /**
   * Recursively scan directory structure
   */
  private async scanDirectory(dirPath: string, depth = 0): Promise<DirectoryNode> {
    const name = basename(dirPath);
    const relativePath = relative(this.repoPath, dirPath);

    if (depth > 0 && this.shouldIgnore(relativePath)) {
      return { name, type: 'directory', children: [] };
    }

    const entries = await readdir(dirPath, { withFileTypes: true });
    const children: DirectoryNode[] = [];

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      const relPath = relative(this.repoPath, entryPath);

      if (IGNORED_DIRS.has(entry.name)) continue;
      if (this.shouldIgnore(relPath)) continue;

      if (entry.isDirectory()) {
        if (depth < 4) { // Limit recursion depth
          const child = await this.scanDirectory(entryPath, depth + 1);
          children.push(child);
        }
      } else if (entry.isFile()) {
        const stats = await stat(entryPath);
        children.push({
          name: entry.name,
          type: 'file',
          size: stats.size,
          extension: extname(entry.name),
        });
      }
    }

    return {
      name,
      type: 'directory',
      children: children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  /**
   * Detect programming languages used in the repository
   */
  private async detectLanguages(): Promise<LanguageInfo[]> {
    const langCounts: Record<string, { count: number; extensions: Set<string> }> = {};
    let totalFiles = 0;

    const walk = async (dirPath: string): Promise<void> => {
      const relativePath = relative(this.repoPath, dirPath);
      if (relativePath && this.shouldIgnore(relativePath)) return;

      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;

        const fullPath = join(dirPath, entry.name);
        const relPath = relative(this.repoPath, fullPath);

        if (this.shouldIgnore(relPath)) continue;

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          const lang = LANGUAGE_EXTENSIONS[ext];
          if (lang) {
            totalFiles++;
            if (!langCounts[lang]) {
              langCounts[lang] = { count: 0, extensions: new Set() };
            }
            langCounts[lang].count++;
            langCounts[lang].extensions.add(ext);
          }
        }
      }
    };

    await walk(this.repoPath);

    return Object.entries(langCounts)
      .map(([name, { count, extensions }]) => ({
        name,
        fileCount: count,
        percentage: Math.round((count / Math.max(totalFiles, 1)) * 100),
        extensions: [...extensions],
      }))
      .sort((a, b) => b.fileCount - a.fileCount);
  }

  /**
   * Find build/package files
   */
  private async findBuildFiles(): Promise<BuildFile[]> {
    const buildFiles: BuildFile[] = [];
    const checked = new Set<string>();

    const checkFile = async (filePath: string, type: BuildFile['type']): Promise<void> => {
      if (checked.has(filePath)) return;
      checked.add(filePath);

      if (existsSync(filePath)) {
        const buildFile: BuildFile = { type, path: relative(this.repoPath, filePath) };

        // Extract scripts from package.json
        if (basename(filePath) === 'package.json') {
          try {
            const content = await readFile(filePath, 'utf-8');
            const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
            if (pkg.scripts) {
              buildFile.scripts = pkg.scripts;
            }
          } catch {
            // Ignore parse errors
          }
        }

        buildFiles.push(buildFile);
      }
    };

    // Check root level
    for (const [pattern, type] of Object.entries(BUILD_FILES)) {
      if (!pattern.includes('*')) {
        await checkFile(join(this.repoPath, pattern), type);
      }
    }

    // Find .csproj, .fsproj, .sln files
    const walk = async (dirPath: string, depth = 0): Promise<void> => {
      if (depth > 2) return;
      const relativePath = relative(this.repoPath, dirPath);
      if (relativePath && this.shouldIgnore(relativePath)) return;

      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          if (['.csproj', '.fsproj', '.sln'].includes(ext)) {
            await checkFile(fullPath, 'dotnet');
          }
        }
      }
    };

    await walk(this.repoPath);

    return buildFiles;
  }

  /**
   * Find configuration files
   */
  private async findConfigFiles(): Promise<ConfigFile[]> {
    const configFiles: ConfigFile[] = [];

    const checkPath = (filePath: string, type: ConfigFile['type']): void => {
      const fullPath = join(this.repoPath, filePath);
      if (existsSync(fullPath)) {
        configFiles.push({ type, path: filePath });
      }
    };

    for (const [pattern, type] of Object.entries(CONFIG_PATTERNS)) {
      checkPath(pattern, type);
    }

    // Check for GitHub Actions
    const workflowsPath = join(this.repoPath, '.github', 'workflows');
    if (existsSync(workflowsPath)) {
      const workflows = await readdir(workflowsPath);
      for (const wf of workflows) {
        if (wf.endsWith('.yml') || wf.endsWith('.yaml')) {
          configFiles.push({
            type: 'ci',
            path: `.github/workflows/${wf}`,
            description: 'GitHub Actions workflow',
          });
        }
      }
    }

    return configFiles;
  }

  /**
   * Extract dependencies from build files
   */
  private async extractDependencies(buildFiles: BuildFile[]): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    for (const buildFile of buildFiles) {
      const fullPath = join(this.repoPath, buildFile.path);

      if (buildFile.type === 'npm' || buildFile.type === 'yarn' || buildFile.type === 'pnpm') {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const pkg = JSON.parse(content) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
          };

          const addDeps = (deps: Record<string, string> | undefined, type: DependencyInfo['type']) => {
            if (!deps) return;
            for (const [name, version] of Object.entries(deps)) {
              dependencies.push({ name, version, type, ecosystem: 'npm' });
            }
          };

          addDeps(pkg.dependencies, 'production');
          addDeps(pkg.devDependencies, 'development');
          addDeps(pkg.peerDependencies, 'peer');
        } catch {
          // Ignore parse errors
        }
      }

      if (buildFile.type === 'pip') {
        try {
          if (basename(buildFile.path) === 'requirements.txt') {
            const content = await readFile(fullPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
            for (const line of lines) {
              const match = line.match(/^([a-zA-Z0-9_-]+)([=<>!~]+.*)?$/);
              if (match) {
                dependencies.push({
                  name: match[1],
                  version: match[2]?.replace(/^[=<>!~]+/, ''),
                  type: 'production',
                  ecosystem: 'pip',
                });
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (buildFile.type === 'dotnet') {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const pkgRefs = content.matchAll(/<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g);
          for (const match of pkgRefs) {
            dependencies.push({
              name: match[1],
              version: match[2],
              type: 'production',
              ecosystem: 'nuget',
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return dependencies;
  }

  /**
   * Find likely entry points
   */
  private findEntryPoints(structure: DirectoryNode, buildFiles: BuildFile[]): string[] {
    const entryPoints: string[] = [];

    // Check package.json main/bin
    const pkgJson = buildFiles.find(bf => bf.path === 'package.json');
    if (pkgJson) {
      const pkgPath = join(this.repoPath, pkgJson.path);
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as { main?: string; bin?: string | Record<string, string> };
        if (pkg.main) entryPoints.push(pkg.main);
        if (typeof pkg.bin === 'string') entryPoints.push(pkg.bin);
        if (typeof pkg.bin === 'object') {
          entryPoints.push(...Object.values(pkg.bin));
        }
      } catch {
        // Ignore
      }
    }

    // Look for common entry point patterns
    const commonEntryPoints = [
      'src/index.ts',
      'src/main.ts',
      'src/app.ts',
      'src/index.js',
      'src/main.js',
      'index.ts',
      'index.js',
      'main.py',
      'app.py',
      'Program.cs',
      'main.go',
      'cmd/main.go',
    ];

    for (const ep of commonEntryPoints) {
      if (existsSync(join(this.repoPath, ep))) {
        if (!entryPoints.includes(ep)) {
          entryPoints.push(ep);
        }
      }
    }

    return entryPoints;
  }

  /**
   * Detect test frameworks
   */
  private detectTestFrameworks(buildFiles: BuildFile[], _structure: DirectoryNode): string[] {
    const frameworks: string[] = [];

    // Check npm dev dependencies
    const pkgJson = buildFiles.find(bf => bf.path === 'package.json');
    if (pkgJson) {
      const pkgPath = join(this.repoPath, pkgJson.path);
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(content) as { devDependencies?: Record<string, string> };
        const devDeps = Object.keys(pkg.devDependencies || {});
        
        if (devDeps.includes('jest')) frameworks.push('Jest');
        if (devDeps.includes('vitest')) frameworks.push('Vitest');
        if (devDeps.includes('mocha')) frameworks.push('Mocha');
        if (devDeps.includes('@playwright/test')) frameworks.push('Playwright');
        if (devDeps.includes('cypress')) frameworks.push('Cypress');
      } catch {
        // Ignore
      }
    }

    // Check for pytest
    if (existsSync(join(this.repoPath, 'pytest.ini')) ||
        existsSync(join(this.repoPath, 'conftest.py'))) {
      frameworks.push('pytest');
    }

    // Check for xunit/nunit
    for (const bf of buildFiles) {
      if (bf.type === 'dotnet') {
        try {
          const content = readFileSync(join(this.repoPath, bf.path), 'utf-8');
          if (content.includes('xunit')) frameworks.push('xUnit');
          if (content.includes('NUnit')) frameworks.push('NUnit');
          if (content.includes('MSTest')) frameworks.push('MSTest');
        } catch {
          // Ignore read errors
        }
      }
    }

    return [...new Set(frameworks)];
  }

  /**
   * Get Git repository information
   */
  private async getGitInfo(): Promise<GitInfo | undefined> {
    const gitDir = join(this.repoPath, '.git');
    if (!existsSync(gitDir)) return undefined;

    const info: GitInfo = {
      hasGitHubActions: existsSync(join(this.repoPath, '.github', 'workflows')),
    };

    // Try to get remote URL
    try {
      const configPath = join(gitDir, 'config');
      const config = await readFile(configPath, 'utf-8');
      const remoteMatch = config.match(/\[remote "origin"\][\s\S]*?url = (.+)/);
      if (remoteMatch) {
        info.remoteUrl = remoteMatch[1].trim();
      }
    } catch {
      // Ignore
    }

    // Try to get default branch
    try {
      const headPath = join(gitDir, 'HEAD');
      const head = await readFile(headPath, 'utf-8');
      const branchMatch = head.match(/ref: refs\/heads\/(.+)/);
      if (branchMatch) {
        info.defaultBranch = branchMatch[1].trim();
      }
    } catch {
      // Ignore
    }

    return info;
  }

  /**
   * Read file content
   */
  async readFile(relativePath: string): Promise<string> {
    return readFile(join(this.repoPath, relativePath), 'utf-8');
  }

  /**
   * Format directory structure as a tree string
   */
  formatStructureTree(node: DirectoryNode, prefix = '', isLast = true): string {
    const lines: string[] = [];
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    if (prefix) {
      lines.push(`${prefix}${connector}${node.name}${node.type === 'directory' ? '/' : ''}`);
    } else {
      lines.push(`${node.name}/`);
    }

    if (node.children) {
      const children = node.children.slice(0, 20); // Limit for readability
      const hasMore = node.children.length > 20;

      children.forEach((child, index) => {
        const childIsLast = index === children.length - 1 && !hasMore;
        lines.push(this.formatStructureTree(child, prefix + extension, childIsLast));
      });

      if (hasMore) {
        lines.push(`${prefix}${extension}└── ... (${node.children.length - 20} more)`);
      }
    }

    return lines.join('\n');
  }
}
