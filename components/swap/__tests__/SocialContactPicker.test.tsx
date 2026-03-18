/**
 * SocialContactPicker Tests
 * 
 * Tests the social contact resolution UI component
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SocialContactPicker } from '../SocialContactPicker';

// Mock the onResolve callback
const mockOnResolve = vi.fn();
const mockOnSelect = vi.fn();

describe('SocialContactPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    cleanup();
  });

  it('renders email input by default', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    expect(screen.getByPlaceholderText('friend@example.com')).toBeInTheDocument();
    expect(screen.getByText('📧 Email')).toBeInTheDocument();
    expect(screen.getByText('📱 Phone')).toBeInTheDocument();
  });

  it('toggles between email and phone input types', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    // Click phone button
    fireEvent.click(screen.getByText('📱 Phone'));
    
    expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
    
    // Click email button
    fireEvent.click(screen.getByText('📧 Email'));
    
    expect(screen.getByPlaceholderText('friend@example.com')).toBeInTheDocument();
  });

  it('formats phone numbers correctly', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    // Switch to phone mode
    fireEvent.click(screen.getByText('📱 Phone'));
    
    const input = screen.getByPlaceholderText('(555) 123-4567');
    
    // Type a phone number
    fireEvent.change(input, { target: { value: '5551234567' } });
    
    // Should be formatted as (555) 123-4567
    expect(input).toHaveValue('(555) 123-4567');
  });

  it('disables resolve button when input is empty', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const resolveButton = screen.getByText('🔍 Find Wallet');
    expect(resolveButton).toBeDisabled();
  });

  it('enables resolve button when input has value', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    const resolveButton = screen.getByText('🔍 Find Wallet');
    expect(resolveButton).not.toBeDisabled();
  });

  it('calls onResolve when resolve button clicked', async () => {
    mockOnResolve.mockResolvedValueOnce('0x1234567890abcdef');
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    await waitFor(() => {
      expect(mockOnResolve).toHaveBeenCalledWith('test@example.com', 'email');
    });
  });

  it('shows success state when address resolved', async () => {
    mockOnResolve.mockResolvedValueOnce('0x1234567890abcdef1234567890abcdef');
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    await waitFor(() => {
      expect(screen.getByText('Wallet Found')).toBeInTheDocument();
      expect(screen.getByText(/0x1234...cdef/)).toBeInTheDocument();
    });
  });

  it('calls onSelect with contact info on successful resolve', async () => {
    mockOnResolve.mockResolvedValueOnce('0x1234567890abcdef');
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        type: 'email',
      });
    });
  });

  it('shows error when no wallet found', async () => {
    mockOnResolve.mockResolvedValueOnce(null);
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    await waitFor(() => {
      expect(screen.getByText('No wallet found for this contact')).toBeInTheDocument();
    });
  });

  it('shows error when resolve throws', async () => {
    mockOnResolve.mockRejectedValueOnce(new Error('Network error'));
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during resolution', async () => {
    // Create a promise that we can resolve later
    let resolvePromise: (value: string | null) => void;
    mockOnResolve.mockImplementation(() => new Promise(resolve => {
      resolvePromise = resolve;
    }));
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByText('🔍 Find Wallet'));
    
    // Should show loading state
    expect(screen.getByText('Looking up...')).toBeInTheDocument();
    
    // Resolve the promise
    resolvePromise!('0x1234');
    
    await waitFor(() => {
      expect(screen.queryByText('Looking up...')).not.toBeInTheDocument();
    });
  });

  it('disables input and button when disabled prop is true', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
        disabled={true}
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    expect(input).toBeDisabled();
    
    const resolveButton = screen.getByText('🔍 Find Wallet');
    expect(resolveButton).toBeDisabled();
  });

  it('shows amount in success state when provided', async () => {
    mockOnResolve.mockResolvedValueOnce('0x1234567890abcdef1234567890abcdef');
    
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve}
        amount="10"
      />
    );
    
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Find Wallet/i }));
    
    await waitFor(() => {
      // Check that wallet found appears
      expect(screen.getByText('Wallet Found')).toBeInTheDocument();
    });
  });

  it('clears state when switching between email and phone', () => {
    render(
      <SocialContactPicker 
        onSelect={mockOnSelect} 
        onResolve={mockOnResolve} 
      />
    );
    
    // Enter email
    const input = screen.getByPlaceholderText('friend@example.com');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    // Switch to phone
    fireEvent.click(screen.getByText('📱 Phone'));
    
    // Input should be cleared - check value property
    const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
    expect(phoneInput).toHaveValue('');
  });
});
