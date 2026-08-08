import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { ChainPill } from '../ChainPill';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useToast } from '@/components/ui/Toast';
import { NETWORKS } from '../../../config';

vi.mock('@/components/wallet/WalletProvider', () => ({
    useWalletContext: vi.fn(),
}));
vi.mock('@/components/ui/Toast', () => ({
    useToast: vi.fn(),
}));

const CELO = NETWORKS.CELO_MAINNET.chainId;
const ARB = NETWORKS.ARBITRUM_ONE.chainId;

const mockSwitch = vi.fn();
const mockShowToast = vi.fn();

beforeEach(() => {
    vi.mocked(useWalletContext).mockReturnValue({
        chainId: CELO,
        switchNetwork: mockSwitch,
    } as any);
    vi.mocked(useToast).mockReturnValue({
        showToast: mockShowToast,
    } as any);
    mockSwitch.mockReset();
    mockShowToast.mockReset();
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('ChainPill', () => {
    it('renders nothing when no wallet is connected', () => {
        vi.mocked(useWalletContext).mockReturnValue({
            chainId: null,
            switchNetwork: mockSwitch,
        } as any);
        const { container } = render(<ChainPill />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the current chain name and icon', () => {
        render(<ChainPill />);
        expect(screen.getByRole('button', { name: /Current chain: Celo/i })).toBeInTheDocument();
    });

    it('does not show the dropdown initially', () => {
        render(<ChainPill />);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('opens the menu and shows the other chain on tap', () => {
        render(<ChainPill />);
        fireEvent.click(screen.getByRole('button', { name: /Current chain: Celo/i }));
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
        expect(within(menu).getByText('Arbitrum')).toBeInTheDocument();
    });

    it('does NOT include the current chain in the menu', () => {
        render(<ChainPill />);
        fireEvent.click(screen.getByRole('button', { name: /Current chain: Celo/i }));
        const menu = screen.getByRole('menu');
        // Celo IS shown in the trigger button above the menu, but the
        // menu itself should only list the OTHER chain.
        const items = within(menu).getAllByRole('menuitem');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveTextContent('Arbitrum');
    });

    it('calls switchNetwork with the target chain when an option is picked', async () => {
        mockSwitch.mockResolvedValueOnce(undefined);
        render(<ChainPill />);
        fireEvent.click(screen.getByRole('button', { name: /Current chain: Celo/i }));
        const menu = screen.getByRole('menu');
        fireEvent.click(within(menu).getByText('Arbitrum'));
        expect(mockSwitch).toHaveBeenCalledWith(ARB);
        expect(mockShowToast).toHaveBeenCalledWith('Switching to Arbitrum…', 'info');
    });

    it('shows a "switch cancelled" toast on user rejection', async () => {
        mockSwitch.mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }));
        render(<ChainPill />);
        fireEvent.click(screen.getByRole('button', { name: /Current chain: Celo/i }));
        const menu = screen.getByRole('menu');
        fireEvent.click(within(menu).getByText('Arbitrum'));
        // Wait for the promise rejection to settle
        await new Promise((r) => setTimeout(r, 10));
        expect(mockShowToast).toHaveBeenCalledWith('Network switch cancelled', 'info');
    });

    it('closes the menu when an option is clicked', async () => {
        mockSwitch.mockResolvedValueOnce(undefined);
        render(<ChainPill />);
        fireEvent.click(screen.getByRole('button', { name: /Current chain: Celo/i }));
        const menu = screen.getByRole('menu');
        fireEvent.click(within(menu).getByText('Arbitrum'));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});

import { within } from '@testing-library/react';
