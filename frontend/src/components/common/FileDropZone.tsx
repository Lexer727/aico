import React, { useState, useCallback } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface FileDropZoneProps {
  acceptedMime?: string;
  onFileUpload: (file: File) => void;
  children?: React.ReactNode;
  className?: string;
}

// @implements SPEC-CORE-007::REQ-004
// @implements SPEC-CORE-007::REQ-007
// @implements SPEC-CORE-007::REQ-012
export const FileDropZone: React.FC<FileDropZoneProps> = ({
  acceptedMime,
  onFileUpload,
  children,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      onFileUpload(file);
    },
    [acceptedMime, onFileUpload]
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
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      validateAndProcessFile(e.clipboardData.files[0]);
    }
  };

  return (
    <div
      data-testid="file-drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className={clsx(
        'relative border-2 border-dashed rounded-lg p-4 transition-all outline-none flex flex-col items-center justify-center cursor-pointer',
        isDragging
          ? 'border-indigo-500 bg-indigo-950/20'
          : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-900/40',
        className
      )}
    >
      <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
      <div className="text-xs text-zinc-300 text-center">{children}</div>

      {errorMessage && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 px-2 py-1 rounded border border-rose-800">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
