import { describe, expect, it } from 'vitest';
import { findEmojiViolations } from '../scripts/emoji-guard.ts';

const rocket = String.fromCodePoint(0x1f680);
const sparkles = String.fromCodePoint(0x2728);
const closeMark = String.fromCodePoint(0x2715);

describe('findEmojiViolations', () => {
  it('flags emoji in ordinary code and strings', () => {
    const result = findEmojiViolations([{ path: 'src/a.ts', content: `const label = '${rocket}';` }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ path: 'src/a.ts', line: 1 });
  });

  it('flags emoji in line and block comments', () => {
    const result = findEmojiViolations([{ path: 'src/a.ts', content: `// ${rocket}\n/* ${sparkles} */` }]);
    expect(result.map((item) => item.line)).toEqual([1, 2]);
  });

  it('allows emoji inside the DEFAULT_DESC input default', () => {
    const result = findEmojiViolations([
      {
        path: 'src/lib/packer.ts',
        content: `export const DEFAULT_DESC =\n  '### ${rocket} 机器概览';`,
      },
    ]);
    expect(result).toEqual([]);
  });

  it('allows emoji on a single-line DEFAULT_DESC', () => {
    const result = findEmojiViolations([
      { path: 'src/pages/upload/+Page.tsx', content: `const DEFAULT_DESC = \`${rocket}\`;` },
    ]);
    expect(result).toEqual([]);
  });

  it('stops allowing emoji after the DEFAULT_DESC declaration', () => {
    const result = findEmojiViolations([
      {
        path: 'src/a.ts',
        content: `const DEFAULT_DESC = '${rocket}';\nconst other = '${sparkles}';`,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.line).toBe(2);
  });

  it('ignores typographic marks that are not emoji', () => {
    const result = findEmojiViolations([{ path: 'src/a.tsx', content: `const label = '${closeMark}';` }]);
    expect(result).toEqual([]);
  });
});
