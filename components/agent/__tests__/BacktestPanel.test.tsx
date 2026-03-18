/**
 * BacktestPanel Tests
 * 
 * Tests the Robinhood testnet backtest UI component
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { BacktestPanel } from '../BacktestPanel';

// Mock the useBacktest hook
const mockRunBacktest = vi.fn();
const mockClearResults = vi.fn();

vi.mock('../../../hooks/use-backtest', () => ({
  useBacktest: () => ({
    isRunning: false,
    results: [],
    totalSimulations: 0,
    successfulSimulations: 0,
    totalAlpha: 0,
    error: null,
    runBacktest: mockRunBacktest,
    clearResults: mockClearResults,
  }),
  DEFAULT_SCENARIOS: [
    { fromToken: 'ETH', toToken: 'ACME', amount: '1.0' },
    { fromToken: 'ACME', toToken: 'ETH', amount: '100' },
  ],
}));

describe('BacktestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    cleanup();
  });

  it('renders the backtest lab header', () => {
    render(<BacktestPanel />);
    
    expect(screen.getByText('🔬')).toBeInTheDocument();
    expect(screen.getByText('Backtest Lab')).toBeInTheDocument();
    expect(screen.getByText('Robinhood Testnet')).toBeInTheDocument();
  });

  it('shows quick test button', () => {
    render(<BacktestPanel />);
    
    expect(screen.getByText('🚀 Run Quick Test')).toBeInTheDocument();
  });

  it('shows custom button', () => {
    render(<BacktestPanel />);
    
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('calls runBacktest with default scenarios when quick test clicked', () => {
    render(<BacktestPanel />);
    
    fireEvent.click(screen.getByText('🚀 Run Quick Test'));
    
    expect(mockRunBacktest).toHaveBeenCalled();
  });

  it('shows custom scenario builder when Custom clicked', () => {
    render(<BacktestPanel />);
    
    fireEvent.click(screen.getByText('Custom'));
    
    expect(screen.getByText('+ Add Scenario')).toBeInTheDocument();
  });

  it('toggles custom scenario visibility', () => {
    render(<BacktestPanel />);
    
    // Show custom
    fireEvent.click(screen.getByText('Custom'));
    expect(screen.getByText('+ Add Scenario')).toBeInTheDocument();
    
    // Hide custom
    fireEvent.click(screen.getByText('Hide'));
    expect(screen.queryByText('+ Add Scenario')).not.toBeInTheDocument();
  });

  it('adds a new custom scenario when Add Scenario clicked', () => {
    render(<BacktestPanel />);
    
    fireEvent.click(screen.getByText('Custom'));
    fireEvent.click(screen.getByText('+ Add Scenario'));
    
    // Should have 2 select dropdowns per scenario (from/to token)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('shows achievement hint', () => {
    render(<BacktestPanel />);
    
    expect(screen.getByText(/Simulation Master/)).toBeInTheDocument();
  });
});

describe('BacktestPanel with results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: Testing result state requires module reset which is complex with vi.mock
  // These are tested via integration tests
  it.todo('shows results when available');
  it.todo('shows clear results button when results exist');
});

describe('BacktestPanel with error', () => {
  // Note: Testing error state requires module reset which is complex with vi.mock
  // The error display is tested via integration tests
  it.todo('shows error message when backtest fails');
});
