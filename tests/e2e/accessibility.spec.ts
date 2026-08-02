import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Ch.17 §178 Accessibility Automation ("axe-core, Lighthouse, Playwright
 * Accessibility Checks... supplements, but does not replace, manual
 * testing") + §220 Accessibility Gate. Scoped to `wcag2a`/`wcag2aa` rules
 * (Ch.17 §156: WCAG 2.2 AA target) and to critical/serious violations —
 * this is the automatable slice of accessibility verification; screen
 * reader and real-device review (§160, §179) still need a human.
 */

const PAGES = ['/', '/login', '/signup', '/privacy', '/terms', '/cart', '/search?q=rose'];

test.describe('Accessibility (axe-core, WCAG 2.2 AA)', () => {
  for (const path of PAGES) {
    test(`${path} has no critical or serious axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

      const severe = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      if (severe.length > 0) {
        console.log(JSON.stringify(severe, null, 2));
      }
      expect(severe).toEqual([]);
    });
  }
});
