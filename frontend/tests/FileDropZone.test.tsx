import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FileDropZone } from '../src/components/common/FileDropZone';

// @verifies ft-core-epic-hub::TASK-CORE-007-12::REQ-004
// @verifies ft-core-epic-hub::TASK-CORE-007-1::REQ-007
// @verifies ft-core-epic-hub::TASK-CORE-007-3::REQ-012
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

  // @verifies ft-core-assets-manager::TASK-ASSET-003::REQ-001
  it('triggers file picker click on dropzone click and processes selected files', () => {
    const handleUpload = vi.fn();

    render(
      <FileDropZone onFileUpload={handleUpload}>
        <span>Click to browse</span>
      </FileDropZone>
    );

    const input = screen.getByTestId('file-drop-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    const dropZone = screen.getByTestId('file-drop-zone');
    fireEvent.click(dropZone);
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(['mock content'], 'design.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(handleUpload).toHaveBeenCalledWith(file);
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-009::REQ-014
  it('validates files against allowedExtensions and rejects unsupported binary files', () => {
    const handleUpload = vi.fn();

    render(
      <FileDropZone
        allowedExtensions={['png', 'txt', 'py', 'ipynb']}
        onFileUpload={handleUpload}
      >
        <span>Upload allowed files</span>
      </FileDropZone>
    );

    const dropZone = screen.getByTestId('file-drop-zone');

    // 1. Disallowed binary file (.exe)
    const badFile = new File([new Uint8Array([0, 1, 2])], 'installer.exe', { type: 'application/x-msdownload' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [badFile] },
    });
    expect(handleUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();

    // 2. Allowed Python file (.py)
    const pyFile = new File(['print("hello")'], 'analysis.py', { type: 'text/x-python' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [pyFile] },
    });
    expect(handleUpload).toHaveBeenCalledWith(pyFile);

    // 3. Allowed Jupyter notebook (.ipynb)
    const ipynbFile = new File(['{"cells":[]}'], 'experiment.ipynb', { type: 'application/json' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [ipynbFile] },
    });
    expect(handleUpload).toHaveBeenCalledWith(ipynbFile);
  });
});
