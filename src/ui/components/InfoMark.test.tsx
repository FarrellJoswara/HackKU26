import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoMark } from '@/ui/components/InfoMark';

describe('<InfoMark />', () => {
  it('renders a button with the provided label', () => {
    render(<InfoMark label="About Rent">Rent helper text</InfoMark>);
    expect(screen.getByRole('button', { name: 'About Rent' })).toBeInTheDocument();
  });

  it('opens the popover on click and exposes aria-expanded', async () => {
    const user = userEvent.setup();
    render(<InfoMark label="Open me">Hidden content</InfoMark>);
    const trigger = screen.getByRole('button', { name: 'Open me' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hidden content');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<InfoMark label="Open me">Hidden content</InfoMark>);
    const trigger = screen.getByRole('button', { name: 'Open me' });
    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('toggles via Enter key on the trigger', async () => {
    const user = userEvent.setup();
    render(<InfoMark label="Toggle">Text</InfoMark>);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    trigger.focus();
    // We deliberately do NOT auto-open on focus (would conflict with
    // click-toggle). Keyboard users press Enter/Space to open.
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('switches role to "dialog" when popoverRole=dialog', async () => {
    const user = userEvent.setup();
    render(
      <InfoMark label="Open" popoverRole="dialog">
        Rich content
      </InfoMark>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
