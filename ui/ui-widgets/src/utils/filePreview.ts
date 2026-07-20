export const canPreviewInWeb = (file: File | string): boolean => {
  let mimeType: string;
  let fileName: string;

  if (file instanceof File) {
    mimeType = file.type;
    fileName = file.name.toLowerCase();
  } else {
    try {
      const parsed = new URL(file);
      fileName = parsed.pathname.toLowerCase();
    } catch {
      fileName = file.split('?')[0].split('#')[0].toLowerCase();
    }
    mimeType = '';
  }

  if (mimeType) {
    if (mimeType.startsWith('image/')) return true;
    if (mimeType === 'application/pdf') return true;
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
  }

  const extension = fileName.split('.').pop() || '';
  const previewableExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
    'pdf',
    'txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx',
    'md', 'markdown', 'yaml', 'yml',
  ];

  return previewableExtensions.includes(extension.toLowerCase());
};

export const openFileInNewTab = (file: File | string): void => {
  if (typeof file === 'string') {
    window.open(file, '_blank', 'noopener,noreferrer');
    return;
  }

  const url = URL.createObjectURL(file);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Revoke after the new tab has a chance to load the blob URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
