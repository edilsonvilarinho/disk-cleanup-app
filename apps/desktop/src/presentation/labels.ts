/** `C:\` → `C:` (formato do plan.json da skill); `/` permanece. */
export function volumeLabel(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, '')
  return trimmed === '' ? root : trimmed
}
