export const MAX_ATTACHMENTS = 5;

export const ATTACHMENT_LIMITS: Record<'IMAGE' | 'DOCUMENT' | 'VIDEO', number> = {
  IMAGE: 5 * 1024 * 1024,
  DOCUMENT: 5 * 1024 * 1024,
  VIDEO: 20 * 1024 * 1024,
};

const KIND_BY_MIME: Record<string, 'IMAGE' | 'DOCUMENT' | 'VIDEO'> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'application/pdf': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCUMENT',
  'video/mp4': 'VIDEO',
  'video/quicktime': 'VIDEO',
  'video/webm': 'VIDEO',
};

export const ATTACHMENT_ACCEPT = Object.keys(KIND_BY_MIME).join(',');

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function validateAttachment(file: File): string | null {
  const kind = KIND_BY_MIME[file.type];
  if (!kind) return `« ${file.name} » : format non supporté`;
  if (file.size > ATTACHMENT_LIMITS[kind]) {
    const maxMb = ATTACHMENT_LIMITS[kind] / (1024 * 1024);
    return `« ${file.name} » dépasse la taille maximale autorisée (${maxMb} Mo)`;
  }
  return null;
}
