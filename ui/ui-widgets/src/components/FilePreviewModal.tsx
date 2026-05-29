import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canPreviewInWeb } from '../utils/filePreview';
import { closeSign, dummyDoc } from '../assets';

interface FilePreviewModalProps {
  file: File | string | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Gets the MIME type for preview rendering
 */
const getPreviewMimeType = (file: File | string): string => {
  if (file instanceof File) {
    return file.type;
  }

  // Infer from extension
  const fileName = file.toLowerCase();
  const extension = fileName.split('.').pop() || '';

  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'text/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'md': 'text/markdown',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
  };

  return mimeMap[extension] || 'application/octet-stream';
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
}) => {
  // Log at the very start of component
  console.log('=== FilePreviewModal RENDER START ===');
  console.log('FilePreviewModal component called - isOpen:', isOpen, 'file:', file ? (file instanceof File ? file.name : file) : 'null');
  console.log('File type:', typeof file, 'Is File:', file instanceof File, 'Is null:', file === null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'text' | 'unsupported'>('unsupported');

  useEffect(() => {
    if (!isOpen || !file) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      return;
    }

    // Check if file can be previewed
    if (!canPreviewInWeb(file)) {
      setPreviewType('unsupported');
      return;
    }

    // Create preview URL
    let url: string;
    if (file instanceof File) {
      url = URL.createObjectURL(file);
    } else {
      // If it's a string, assume it's already a URL
      url = file;
    }

    setPreviewUrl(url);

    // Determine preview type
    const mimeType = getPreviewMimeType(file);
    if (mimeType.startsWith('image/')) {
      setPreviewType('image');
    } else if (mimeType === 'application/pdf') {
      setPreviewType('pdf');
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      setPreviewType('text');
    } else {
      setPreviewType('unsupported');
    }

    // Cleanup function
    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  console.log('FilePreviewModal render check - isOpen:', isOpen, 'file:', file ? (file instanceof File ? file.name : file) : 'null');

  if (!isOpen || !file) {
    console.log('Modal not rendering - isOpen:', isOpen, 'file:', !!file);
    return null;
  }

  console.log('Modal will render!');

  const fileName = file instanceof File ? file.name : file.split('/').pop() || 'file';
  const canPreview = canPreviewInWeb(file);
  console.log('Modal rendering - fileName:', fileName, 'canPreview:', canPreview, 'previewUrl:', previewUrl, 'previewType:', previewType);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
      style={{ position: 'fixed', zIndex: 9999 }}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-7xl max-h-[90vh] w-full m-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-4">
            {fileName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
            aria-label="Close preview"
          >
            <img
              src={closeSign}
              alt="Close Preview"
              className="w-6 h-6"
            />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {!canPreview ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <img
                  src={dummyDoc}
                  alt="Preview not available"
                  className="w-24 h-24 mx-auto mb-4"
                />
                <p className="mt-4 text-sm text-gray-500">
                  Preview not available for this file type
                </p>
              </div>
            </div>
          ) : previewType === 'image' && previewUrl ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : previewType === 'pdf' && previewUrl ? (
            <div className="h-full min-h-[600px]">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={fileName}
              />
            </div>
          ) : previewType === 'text' && previewUrl ? (
            <div className="bg-white rounded border border-gray-200 p-4 h-full min-h-[400px]">
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 font-mono overflow-auto h-full">
                <TextFilePreview url={previewUrl} />
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <p className="text-sm text-gray-500">Loading preview...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render modal using portal to ensure it's at the document body level
  if (typeof document !== 'undefined' && document.body) {
    console.log('Rendering modal via portal to document.body');
    try {
      return createPortal(modalContent, document.body);
    } catch (error) {
      console.error('Error creating portal:', error);
      return modalContent;
    }
  } else {
    console.warn('document.body not available, rendering inline');
    return modalContent;
  }
};

/**
 * Component to fetch and display text file content
 */
const TextFilePreview: React.FC<{ url: string }> = ({ url }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (url.startsWith('blob:')) {
      // For blob URLs (File objects), fetch the content
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      // For regular URLs, try to fetch
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [url]);

  if (loading) return <span>Loading...</span>;
  if (error) return <span className="text-red-500">Error: {error}</span>;
  return <span>{content}</span>;
};
