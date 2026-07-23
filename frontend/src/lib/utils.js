/**
 * Format bytes to a human-readable string.
 * e.g. 1048576 -> "1.0 MB"
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format an ISO date string to a readable date.
 * e.g. "2026-07-04T06:03:43.000Z" -> "4 Jul 2026"
 */
export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoString));
}

/**
 * Returns true if the file is a PDF.
 */
export function isPdf(file) {
  return file?.mimeType === 'application/pdf' || file?.fileType === 'pdf';
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Dynamically calculate readable text color for a given hex background.
 */
export function getContrastYIQ(hexcolor) {
  if (!hexcolor) return '#000000';
  hexcolor = hexcolor.replace('#', '');
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(c => c + c).join('');
  }
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}