export const canPreviewInWeb = (file: File | string): boolean => {
  let mimeType: string;
  let fileName: string;

  if (file instanceof File) {
    mimeType = file.type;
    fileName = file.name.toLowerCase();
  } else {
    fileName = file.toLowerCase();
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
