import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StatCard } from '../components/common/StatCard';

describe('StatCard component', () => {
  it('renders title, value and unit properly', () => {
    render(
      <StatCard
        title="Consumo Total"
        value="155.2"
        unit="MWh"
        subtitle="Últimos 14 días"
      />
    );

    expect(screen.getByText('Consumo Total')).toBeInTheDocument();
    expect(screen.getByText('155.2')).toBeInTheDocument();
    expect(screen.getByText('MWh')).toBeInTheDocument();
    expect(screen.getByText('Últimos 14 días')).toBeInTheDocument();
  });

  it('renders delta badge when delta is provided', () => {
    render(
      <StatCard
        title="Medidores Críticos"
        value={1}
        delta={110.7}
        isSeverityCritical={true}
      />
    );

    expect(screen.getByText('+110.7%')).toBeInTheDocument();
  });

  it('calls onClick and onAskAI callbacks when clicked', () => {
    const handleClick = vi.fn();
    const handleAskAI = vi.fn();

    render(
      <StatCard
        title="Anomalías"
        value={4}
        onClick={handleClick}
        onAskAI={handleAskAI}
      />
    );

    const askButton = screen.getByTitle('Preguntar a la IA sobre Anomalías');
    fireEvent.click(askButton);
    expect(handleAskAI).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Anomalías'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
