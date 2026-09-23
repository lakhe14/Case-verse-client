import { expect } from '@playwright/test';

export const VIEWPORT_MATRIX = [
  { name: 'mobile 360x800', width: 360, height: 800 },
  { name: 'mobile 375x812', width: 375, height: 812 },
  { name: 'mobile 390x844', width: 390, height: 844 },
  { name: 'mobile 400x689', width: 400, height: 689 },
  { name: 'mobile 430x932', width: 430, height: 932 },
  { name: 'tablet 768x1024', width: 768, height: 1024 },
  { name: 'tablet 1024x768', width: 1024, height: 768 },
  { name: 'desktop 1366x768', width: 1366, height: 768 },
  { name: 'desktop 1440x900', width: 1440, height: 900 },
];

/** Representative sizes for deep interaction flows. */
export const REPRESENTATIVE = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1366, height: 768 },
};

export async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
