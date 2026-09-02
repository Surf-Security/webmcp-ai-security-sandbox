/** Triggers a browser download of in-memory content — one shared implementation of the
 * Blob/object-URL/anchor-click dance instead of each export feature reimplementing it. */
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
