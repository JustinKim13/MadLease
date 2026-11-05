import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeContext } from '../context/ThemeContext';
import StatusBadge from './StatusBadge';

function renderWithTheme(ui, darkMode = true) {
  return render(
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode: () => {} }}>
      {ui}
    </ThemeContext.Provider>
  );
}

describe('StatusBadge', () => {
  it('renders the correct label for each known status', () => {
    renderWithTheme(<StatusBadge status="AVAILABLE" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('falls back to the AVAILABLE config for an unknown status', () => {
    renderWithTheme(<StatusBadge status="SOME_MADE_UP_STATUS" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders as a <button> and fires onClick when a handler is passed', () => {
    const handleClick = vi.fn();
    renderWithTheme(<StatusBadge status="PENDING" onClick={handleClick} />);

    const button = screen.getByRole('button', { name: /pending/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a plain <span> (no button role) when no onClick is passed', () => {
    renderWithTheme(<StatusBadge status="COMPLETED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
