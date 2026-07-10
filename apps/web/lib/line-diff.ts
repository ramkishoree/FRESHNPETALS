export type DiffLine = { type: 'added' | 'removed' | 'unchanged'; text: string };

/**
 * Minimal LCS-based line diff — no dependency pulled in for something this
 * small. O(n·m); fine for prompt-version text (short, line-count in the
 * tens/hundreds), not meant for large-document diffing.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i]![j] =
        oldLines[i] === newLines[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'unchanged', text: oldLines[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      result.push({ type: 'removed', text: oldLines[i]! });
      i++;
    } else {
      result.push({ type: 'added', text: newLines[j]! });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: 'removed', text: oldLines[i]! });
    i++;
  }
  while (j < n) {
    result.push({ type: 'added', text: newLines[j]! });
    j++;
  }

  return result;
}
