import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { BacktestProvider, useBacktestContext } from '../BacktestContext';

// Mock React.createElement for the provider
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return { ...actual };
});

describe('BacktestContext', () => {
  it('provides initial state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BacktestProvider>{children}</BacktestProvider>
    );
    
    const { result } = renderHook(() => useBacktestContext(), { wrapper });
    
    expect(result.current.isRunning).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(result.current.totalSimulations).toBe(0);
    expect(result.current.successfulSimulations).toBe(0);
    expect(result.current.totalAlpha).toBe(0);
    expect(result.current.lastRunAt).toBeNull();
  });

  it('setBacktestState updates state partially', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BacktestProvider>{children}</BacktestProvider>
    );
    
    const { result } = renderHook(() => useBacktestContext(), { wrapper });
    
    act(() => {
      result.current.setBacktestState({ isRunning: true });
    });
    
    expect(result.current.isRunning).toBe(true);
    expect(result.current.totalSimulations).toBe(0); // Other values unchanged
  });

  it('clearResults resets to initial state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BacktestProvider>{children}</BacktestProvider>
    );
    
    const { result } = renderHook(() => useBacktestContext(), { wrapper });
    
    // Set some state
    act(() => {
      result.current.setBacktestState({ 
        isRunning: true, 
        totalSimulations: 5,
        totalAlpha: 2.5,
      });
    });
    
    // Clear it
    act(() => {
      result.current.clearResults();
    });
    
    expect(result.current.isRunning).toBe(false);
    expect(result.current.totalSimulations).toBe(0);
    expect(result.current.totalAlpha).toBe(0);
  });

  it('addResults appends results and updates totals', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BacktestProvider>{children}</BacktestProvider>
    );
    
    const { result } = renderHook(() => useBacktestContext(), { wrapper });
    
    const mockResults = [
      { scenario: { fromToken: 'ETH', toToken: 'ACME', amount: '1' }, success: true },
      { scenario: { fromToken: 'ACME', toToken: 'ETH', amount: '100' }, success: false },
    ];
    
    act(() => {
      result.current.addResults(mockResults, 1.5);
    });
    
    expect(result.current.results).toHaveLength(2);
    expect(result.current.totalSimulations).toBe(2);
    expect(result.current.successfulSimulations).toBe(1);
    expect(result.current.totalAlpha).toBe(1.5);
    expect(result.current.lastRunAt).toBeGreaterThan(0);
  });

  it('addResults accumulates results across calls', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <BacktestProvider>{children}</BacktestProvider>
    );
    
    const { result } = renderHook(() => useBacktestContext(), { wrapper });
    
    act(() => {
      result.current.addResults([
        { scenario: { fromToken: 'ETH', toToken: 'ACME', amount: '1' }, success: true },
      ], 1.0);
    });
    
    act(() => {
      result.current.addResults([
        { scenario: { fromToken: 'ETH', toToken: 'SPACELY', amount: '0.5' }, success: true },
      ], 0.5);
    });
    
    expect(result.current.results).toHaveLength(2);
    expect(result.current.totalAlpha).toBe(1.5);
    expect(result.current.successfulSimulations).toBe(2);
  });

  it('throws error when useBacktestContext is used outside provider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useBacktestContext());
    }).toThrow('useBacktestContext must be used within BacktestProvider');
    
    spy.mockRestore();
  });
});
