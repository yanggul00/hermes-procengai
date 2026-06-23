// Mirrors session-export.ts's sanitizeFilenamePart, but yields "<title>.pdf"
// (the user wants the title AS the filename; no id suffix).
function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function pdfFilenameFromTitle(title?: string | null): string {
  const part = title ? sanitizeFilenamePart(title) : ''

  return `${part || 'session'}.pdf`
}
