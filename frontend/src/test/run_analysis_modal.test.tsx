import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RunAnalysisModal } from '../components/analysis/RunAnalysisModal';

describe('RunAnalysisModal component', () => {
  it('does not render content when isOpen is false', () => {
    const handleClose = vi.fn();
    render(<RunAnalysisModal isOpen={false} onClose={handleClose} />);

    expect(screen.queryByText(/Pipeline de Inteligencia Artificial/i)).not.toBeInTheDocument();
  });

  it('renders modal header and pipeline description when isOpen is true', () => {
    const handleClose = vi.fn();
    render(<RunAnalysisModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByText(/Pipeline de Inteligencia Artificial/i)).toBeInTheDocument();
    expect(screen.getByText(/Estado de Ejecución/i)).toBeInTheDocument();
  });
});
