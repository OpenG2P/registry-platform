/**
 * Utility functions for file preview functionality
 */

/**
 * Determines if a file type can be previewed in the web browser
 */
export const canPreviewInWeb = (file: File | string): boolean => {
  let mimeType: string;
  let fileName: string;

  if (file instanceof File) {
    mimeType = file.type;
    fileName = file.name.toLowerCase();
  } else {
    // If it's a string (URL or path), try to infer from extension
    fileName = file.toLowerCase();
    mimeType = '';
  }

  // Check by MIME type first
  if (mimeType) {
    if (mimeType.startsWith('image/')) return true;
    if (mimeType === 'application/pdf') return true;
    if (mimeType.startsWith('text/')) return true;
    if (mimeType === 'application/json') return true;
  }

  // Check by file extension
  const extension = fileName.split('.').pop() || '';
  const previewableExtensions = [
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico',
    // Documents
    'pdf',
    // Text files
    'txt', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx',
    'md', 'markdown', 'yaml', 'yml'
  ];

  return previewableExtensions.includes(extension.toLowerCase());
};
