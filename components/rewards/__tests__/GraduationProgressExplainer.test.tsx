/**
 * GraduationProgressExplainer Tests
 * 
 * Tests the Testnet → Mainnet progression guide
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { GraduationProgressExplainer } from '../GraduationProgressExplainer';

// Mock useStreakRewards hook
const mockSwitchNetwork = vi.fn();

vi.mock('../../../hooks/use-streak-rewards', () => ({
  useStreakRewards: () => ({
    crossChainActivity: {
      testnet: {
        totalSwaps: 0,
        totalClaims: 0,
        chainsUsed: [],
      },
      graduation: {
        isGraduated: false,
        graduatedAt: null,
      },
    },
    achievements: [],
    eligibleForGraduation: false,
  }),
}));

vi.mock('../../wallet/WalletProvider', () => ({
  useWalletContext: () => ({
    switchNetwork: mockSwitchNetwork,
  }),
}));

describe('GraduationProgressExplainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    cleanup();
  });

  describe('Full mode (default)', () => {
    it('renders the journey header', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText('🎓 Your Journey to Mainnet')).toBeInTheDocument();
    });

    it('shows all three steps', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText('Learn')).toBeInTheDocument();
      expect(screen.getByText('Prove')).toBeInTheDocument();
      expect(screen.getByText('Graduate')).toBeInTheDocument();
    });

    it('shows step descriptions', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText(/Practice with testnet tokens/)).toBeInTheDocument();
      expect(screen.getByText(/Demonstrate consistent safe behavior/)).toBeInTheDocument();
      expect(screen.getByText(/Move to mainnet/)).toBeInTheDocument();
    });

    it('shows chain badges for each step', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText('Celo Sepolia')).toBeInTheDocument();
      expect(screen.getByText('Arc Testnet')).toBeInTheDocument();
      expect(screen.getByText('RH Testnet')).toBeInTheDocument();
    });

    it('shows current step indicator', () => {
      render(<GraduationProgressExplainer />);
      
      // Learn should be the current step when starting
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('shows testnet CTA button when not graduated', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText('🧪')).toBeInTheDocument();
      expect(screen.getByText('Start Learning on Testnet')).toBeInTheDocument();
    });

    it('calls switchNetwork when testnet button clicked', () => {
      render(<GraduationProgressExplainer />);
      
      fireEvent.click(screen.getByText('Start Learning on Testnet'));
      
      expect(mockSwitchNetwork).toHaveBeenCalled();
    });

    it('shows faucet link', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText('celo.org/faucet')).toBeInTheDocument();
    });

    it('shows progress summary', () => {
      render(<GraduationProgressExplainer />);
      
      expect(screen.getByText(/Your progress:/)).toBeInTheDocument();
      expect(screen.getByText(/0 swaps/)).toBeInTheDocument();
      expect(screen.getByText(/0 chain/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<GraduationProgressExplainer className="custom-class" />);
      
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('renders compact step indicators', () => {
      render(<GraduationProgressExplainer compact />);
      
      // Should have 3 step circles (icons or checkmarks)
      const circles = screen.getAllByTitle(/Learn|Prove|Graduate/);
      expect(circles).toHaveLength(3);
    });

    it('shows connector lines between steps', () => {
      const { container } = render(<GraduationProgressExplainer compact />);
      
      // Should have 2 connector lines between 3 steps
      const connectors = container.querySelectorAll('.h-0\\.5');
      expect(connectors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('GraduationProgressExplainer with progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
  });

  it.todo('shows "Prove" as current step when 3+ swaps on 1 chain');
  it.todo('shows "Graduate" as current step when eligible');
  it.todo('shows achievements count when badges earned');
  it.todo('hides CTA when user has 3+ swaps');
  it.todo('shows "Graduated!" badge when isGraduated is true');
});
