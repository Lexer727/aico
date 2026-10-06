import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FileDropZone } from '../src/components/common/FileDropZone';

// @verifies spec-ft-core-epic-hub::REQ-004
// @verifies spec-ft-core-epic-hub::REQ-007
// @verifies spec-ft-core-epic-hub::REQ-012
describe('FileDropZone Component', () => {
  it('accepts valid files via drop and triggers onFileUpload callback', () => {
    const handleUpload = vi.fn();

    render(
      <FileDropZone
        acceptedMime="image/*"
        onFileUpload={handleUpload}
      >
        <span>Drop your files here</span>
      </FileDropZone>
    );

    expect(screen.getByText(/drop your files here/i)).toBeInTheDocument();

    const file = new File(['dummy png data'], 'mockup.png', { type: 'image/png' });
    const dropZone = screen.getByTestId('file-drop-zone');

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(handleUpload).toHaveBeenCalledWith(file);
  });

  it('rejects files violating MIME type constraint and displays error', () => {
    const handleUpload = vi.fn();

    render(
      <FileDropZone
        acceptedMime="image/*"
        onFileUpload={handleUpload}
      >
        <span>Drop image</span>
      </FileDropZone>
    );

    const file = new File(['text content'], 'notes.txt', { type: 'text/plain' });
    const dropZone = screen.getByTestId('file-drop-zone');

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(handleUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });
});
