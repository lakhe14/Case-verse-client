import { expect } from '@playwright/test';

/** The searchable ParcelMoover destination field (a combobox, not a native select). */
export const destinationInput = (page) => page.getByRole('combobox', { name: 'ParcelMoover delivery destination' });

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Types into the destination combobox and picks the first option whose
 * accessible name starts with `option` (a string) or matches it (a RegExp).
 */
export async function chooseDestination(page, search, option) {
  const input = destinationInput(page);
  await expect(input).toBeEnabled({ timeout: 15_000 });
  await input.click();
  await input.fill(search);
  const name = typeof option === 'string' ? new RegExp(`^${escapeRegExp(option)}`) : option;
  const choice = page.getByRole('option', { name }).first();
  await expect(choice).toBeVisible({ timeout: 10_000 });
  await choice.click();
}
