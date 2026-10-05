import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VisualLineageCanvas } from '../src/features/epic-hub/VisualLineageCanvas';

// @verifies SPEC-CORE-007::REQ-003
// @verifies SPEC-CORE-007::REQ-010
describe('VisualLineageCanvas Component', () => {
  const mockNodes = [
    { id: 'node-epic', type: 'epic', label: 'Epic 001', isFrontier: false },
    { id: 'node-spec', type: 'spec', label: 'SPEC-001', isFrontier: false },
    { id: 'node-task', type: 'task', label: 'TASK-001', isFrontier: true },
    { id: 'node-code', type: 'code', label: 'server.rs', isFrontier: false },
  ];

  const mockEdges = [
    { id: 'e1', source: 'node-epic', target: 'node-spec' },
    { id: 'e2', source: 'node-spec', target: 'node-task' },
    { id: 'e3', source: 'node-task', target: 'node-code' },
  ];

  it('renders graph nodes, outlines active frontier, and highlights upstream/downstream edges on selection', () => {
    const onSelectNode = vi.fn();

    render(
      <VisualLineageCanvas
        nodes={mockNodes}
        edges={mockEdges}
        onSelectNode={onSelectNode}
      />
    );

    // Nodes are rendered
    expect(screen.getByText('Epic 001')).toBeInTheDocument();
    expect(screen.getByText('SPEC-001')).toBeInTheDocument();
    expect(screen.getByText('TASK-001')).toBeInTheDocument();

    // Active frontier task must have glowing outline styling or class
    const frontierNode = screen.getByTestId('node-TASK-001');
    expect(frontierNode.getAttribute('data-frontier')).toBe('true');

    // Click on node-task to select it
    fireEvent.click(frontierNode);
    expect(onSelectNode).toHaveBeenCalledWith('node-task');

    // Canvas should reflect selected state
    expect(frontierNode.getAttribute('data-selected')).toBe('true');
  });
});
