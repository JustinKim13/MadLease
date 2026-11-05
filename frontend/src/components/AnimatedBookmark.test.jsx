import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnimatedBookmark from './AnimatedBookmark';

describe('AnimatedBookmark', () => {
  it('renders two overlaid bookmark svgs at the requested size', () => {
    const { container } = render(<AnimatedBookmark isSaved={false} darkMode={true} size={30} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('width', '30');
      expect(svg).toHaveAttribute('height', '30');
    });
  });

  it('hides the filled (saved) svg when isSaved is false', () => {
    const { container } = render(<AnimatedBookmark isSaved={false} darkMode={false} />);
    const [, filledSvg] = container.querySelectorAll('svg');
    expect(filledSvg.style.opacity).toBe('0');
  });

  it('reveals the filled (saved) svg when isSaved is true', () => {
    const { container } = render(<AnimatedBookmark isSaved={true} darkMode={false} />);
    const [, filledSvg] = container.querySelectorAll('svg');
    expect(filledSvg.style.opacity).toBe('1');
  });
});
