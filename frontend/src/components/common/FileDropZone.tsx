import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export interface FileDropZoneProps {
  acceptedMime?: string;
  allowedExtensions?: string[];
  allowUtf8Text?: boolean;
  onFileUpload: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
}

// @implements spec-ft-core-epic-hub::REQ-004
// @implements spec-ft-core-epic-hub::REQ-007
// @implements spec-ft-core-epic-hub::REQ-012
// @implements spec-ft-core-assets-manager::REQ-001
// @implements spec-ft-core-assets-manager::REQ-014
export const FileDropZone: React.FC<FileDropZoneProps> = ({
  acceptedMime,
  allowedExtensions,
  allowUtf8Text = true,
  onFileUpload,
  children,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = useCallback(
    (file: File) => {
      setErrorMessage(null);

      if (acceptedMime) {
        let isMatch = false;
        if (acceptedMime.endsWith('/*')) {
          const prefix = acceptedMime.slice(0, -1);
          isMatch = file.type.startsWith(prefix);
        } else {
          isMatch = file.type === acceptedMime;
        }

        if (!isMatch) {
          setErrorMessage(`Invalid file type: expected ${acceptedMime}, received ${file.type || 'unknown'}`);
          return;
        }
      }

      if (allowedExtensions && allowedExtensions.length > 0) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const lowerName = file.name.toLowerCase();
        const normAllowed = allowedExtensions.map((e) => e.toLowerCase().replace(/^\./, ''));
        const extMatches = normAllowed.includes(ext) || normAllowed.includes(lowerName);

        if (!extMatches) {
          // If extension not explicitly listed, check if it's an image or text/code file
          const isImage = file.type.startsWith('image/');
          const isText = file.type.startsWith('text/');
          if (!isImage && (!allowUtf8Text || !isText)) {
            setErrorMessage(`Unsupported file type: only images and readable text/code files are permitted.`);
            return;
          }
        }
      }

      onFileUpload(file);
    },
    [acceptedMime, allowedExtensions, allowUtf8Text, onFileUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        validateAndProcessFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        validateAndProcessFile(e.clipboardData.files[i]);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        validateAndProcessFile(e.target.files[i]);
      }
      e.target.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const acceptAttr = acceptedMime
    ? acceptedMime
    : allowedExtensions && allowedExtensions.length > 0
    ? allowedExtensions.map((e) => `.${e.replace(/^\./, '')}`).join(',') + ',image/*,text/*'
    : undefined;

  return (
    <div
      data-testid="file-drop-zone"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      role="button"
      className={clsx(
        'relative border-2 border-dashed rounded-lg p-4 transition-all outline-none flex flex-col items-center justify-center cursor-pointer select-none',
        isDragging
          ? 'border-indigo-500 bg-indigo-950/20'
          : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40',
        className
      )}
    >
      <input
        type="file"
        data-testid="file-drop-input"
        ref={fileInputRef}
        className="hidden"
        accept={acceptAttr}
        multiple
        onChange={handleFileInputChange}
      />
      <UploadCloud className="w-8 h-8 text-zinc-400 mb-2 pointer-events-none" />
      <div className="text-xs text-zinc-300 text-center pointer-events-none">{children}</div>

      {errorMessage && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 px-2 py-1 rounded border border-rose-800 pointer-events-none">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
