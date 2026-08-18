import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroCarousel, type HeroSlide } from './hero-carousel';

function slide(id: string, overrides: Partial<HeroSlide> = {}): HeroSlide {
  return {
    id,
    slotOrder: Number(id),
    mediaUrl: `https://cdn.example/${id}.webp`,
    captionText: null,
    ...overrides,
  };
}

describe('HeroCarousel', () => {
  it('marks exactly one slide active, with a class the stylesheet can match', () => {
    // The bug this pins shipped: the active modifier was concatenated
    // without a separating space, so the element carried a single
    // "hero-slideis-active" token. Neither `.hero-slide` nor
    // `.is-active` matched it, so no slide was ever positioned or faded
    // and the band only looked right while a single slide was in it.
    const { container } = render(<HeroCarousel slides={[slide('1'), slide('2')]} />);

    expect(container.querySelectorAll('.hero-slide')).toHaveLength(2);
    expect(container.querySelectorAll('.hero-slide.is-active')).toHaveLength(1);
  });

  it('renders nothing at all when no slot is filled', () => {
    // An empty band would still occupy its capped height and push the
    // catalogue down for no reason.
    const { container } = render(<HeroCarousel slides={[]} />);

    expect(container.querySelector('.hero-band')).toBeNull();
  });

  it('draws the scrim only under a caption', () => {
    const withCaption = render(
      <HeroCarousel slides={[slide('1', { captionText: 'Summer blooms are near' })]} />,
    );
    expect(withCaption.container.querySelector('.hero-scrim')).not.toBeNull();

    const without = render(<HeroCarousel slides={[slide('2')]} />);
    expect(without.container.querySelector('.hero-scrim')).toBeNull();
  });

  it('offers dots only when there is somewhere to rotate to', () => {
    const single = render(<HeroCarousel slides={[slide('1')]} />);
    expect(single.container.querySelector('.hero-dots')).toBeNull();

    const pair = render(<HeroCarousel slides={[slide('1'), slide('2')]} />);
    expect(pair.container.querySelectorAll('.hero-dots button')).toHaveLength(2);
  });
});
