import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface SourceFile {
  path: string;
  content: string;
}

export interface EmojiViolation {
  path: string;
  line: number;
  emoji: string;
}

// Emoji presentation, or an emoji base plus variation selector.
// Typographic marks (e.g. U+2715) are not matched.
const emojiPattern = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)/gu;
const defaultDescStart = /^\s*(?:export\s+)?const\s+DEFAULT_DESC\s*=/;
const commentStart = /^\s*(?:\/\/|\/\*|\*)/;

// 输入框默认文案是 emoji 规则的唯一例外。
export function findEmojiViolations(files: SourceFile[]): EmojiViolation[] {
  const violations: EmojiViolation[] = [];
  for (const file of files) {
    let inDefaultDesc = false;
    file.content.split(/\r?\n/).forEach((line, index) => {
      if (defaultDescStart.test(line)) inDefaultDesc = true;
      const isComment = commentStart.test(line);
      const matches = line.match(emojiPattern);
      if (matches && (!inDefaultDesc || isComment)) {
        for (const emoji of matches) {
          violations.push({ path: file.path, line: index + 1, emoji });
        }
      }
      if (inDefaultDesc && /;\s*$/.test(line)) inDefaultDesc = false;
    });
  }
  return violations;
}

const roots = ['src', 'api', 'scripts', 'data', 'test', 'e2e', 'workers', 'packages', 'css'];
const extensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css']);
const ignoredDirs = new Set([
  'node_modules',
  'vendor',
  'dist',
  'content',
  'archive',
  'temp-opencode',
  '.git',
  '.agents',
  '.docs',
  'test-results',
  'playwright-report',
  'blob-report',
  '.idea',
]);
const ignoredFiles = [/[\\/]resource[\\/]/, /Output\.css$/, /\.min\.js$/];

function collectFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) collectFiles(full, files);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    if (ignoredFiles.some((pattern) => pattern.test(full))) continue;
    files.push(full);
  }
  return files;
}

function main(): void {
  const files = roots.flatMap((root) => collectFiles(root));
  const sources: SourceFile[] = files.map((file) => ({
    path: path.relative(process.cwd(), file),
    content: fs.readFileSync(file, 'utf8'),
  }));
  const violations = findEmojiViolations(sources);
  if (violations.length === 0) {
    console.log(`Emoji guard: ${sources.length} files OK`);
    return;
  }
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line}: ${violation.emoji}`);
  }
  console.error(`Emoji guard: ${violations.length} violation(s)`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
