import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonLd } from './json-ld';

describe('JsonLd', () => {
  it('renders valid, parseable JSON-LD for real schema data', () => {
    const { container } = render(
      <JsonLd
        data={{ '@context': 'https://schema.org', '@type': 'Product', name: 'Rose Bouquet' }}
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.innerHTML)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Rose Bouquet',
    });
  });

  it('escapes a `</script>` substring so it cannot break out of the tag', () => {
    const { container } = render(<JsonLd data={{ name: '</script><script>alert(1)</script>' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script!.innerHTML).not.toContain('</script><script>');
    // Still round-trips to the exact original string once parsed.
    expect(JSON.parse(script!.innerHTML)).toEqual({
      name: '</script><script>alert(1)</script>',
    });
  });
});
