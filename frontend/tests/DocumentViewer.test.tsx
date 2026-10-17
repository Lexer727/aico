import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DocumentViewer } from '../src/features/document-viewer/DocumentViewer';

// Mock fetchFeature and fetchEpic
vi.mock('../src/features/feature-task-data', () => ({
  fetchFeature: vi.fn().mockImplementation((id: string) => {
    if (id === 'ft-fast-trace') {
      return Promise.resolve({
        id: 'ft-fast-trace',
        name: 'Fast Traceability Validator',
        epicId: 'ec-core',
        status: 'Completed',
        brainstorm_content: '# Fast Trace Brainstorm\n\nFull brainstorm body content here.',
      });
    }
    return Promise.resolve(null);
  }),
  fetchEpic: vi.fn().mockImplementation((id: string) => {
    if (id === 'ec-core') {
      return Promise.resolve({
        id: 'ec-core',
        title: 'AICO Core Architecture',
        status: 'In Progress',
        brainstorm_content: '# Core Epic Brainstorm\n\nCore architectural trade-offs.',
      });
    }
    return Promise.resolve(null);
  }),
}));

// @verifies ft-core-epic-hub::TASK-CORE-007-12::REQ-001
// @verifies ft-core-epic-hub::TASK-CORE-007-12::REQ-004
describe('DocumentViewer Component', () => {
  it('renders status in top right, aico_version below it, and no Back to Dashboard button', async () => {
    render(
      <DocumentViewer
        docId="brainstorm-ft-fast-trace"
        docType="brainstorm"
      />
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Brainstorm: Fast Traceability Validator' })).toBeInTheDocument();

    // Verify "Back to Dashboard" is NOT rendered
    expect(screen.queryByText(/Back to Dashboard/i)).not.toBeInTheDocument();

    // Verify status badge and aico_version are rendered
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('aico_version: 0.1.2')).toBeInTheDocument();
  });

  it('renders clickable tags for Feature and Epic that trigger navigation callbacks', async () => {
    const onOpenFeature = vi.fn();
    const onOpenEpic = vi.fn();

    render(
      <DocumentViewer
        docId="brainstorm-ft-fast-trace"
        docType="brainstorm"
        onOpenFeature={onOpenFeature}
        onOpenEpic={onOpenEpic}
      />
    );

    await screen.findByRole('heading', { level: 1, name: 'Brainstorm: Fast Traceability Validator' });

    // Feature tag
    const featTag = screen.getByTestId('tag-badge-ft-fast-trace');
    fireEvent.click(featTag);
    expect(onOpenFeature).toHaveBeenCalledWith('ft-fast-trace');

    // Epic tag
    const epicTag = screen.getByTestId('tag-badge-ec-core');
    fireEvent.click(epicTag);
    expect(onOpenEpic).toHaveBeenCalledWith('ec-core');
  });

  it('toggles between formatted markdown view and raw markdown source code', async () => {
    render(
      <DocumentViewer
        docId="brainstorm-ft-fast-trace"
        docType="brainstorm"
      />
    );

    await screen.findByRole('heading', { level: 1, name: 'Brainstorm: Fast Traceability Validator' });

    // Click markdown toggle button
    const mdToggle = screen.getByTestId('toggle-raw-markdown');
    expect(mdToggle).toBeInTheDocument();
    fireEvent.click(mdToggle);

    // Shows preformatted code block with unstripped content
    expect(screen.getByText(/# Fast Trace Brainstorm/i)).toBeInTheDocument();

    // Toggle back
    fireEvent.click(mdToggle);
    expect(screen.queryByText(/# Fast Trace Brainstorm/i)).not.toBeInTheDocument();
  });
});
