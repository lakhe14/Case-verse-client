import { expect } from '@playwright/test';
import { API } from './session.js';

/** A guest-cart line built from a real in-stock catalog variant (read-only API call). */
export async function realGuestLine(request, slug) {
  const response = await request.get(`${API}/products/${slug}`);
  expect(response.status(), `catalog ${slug}`).toBe(200);
  const { data: product } = await response.json();
  const variant = product.variants.find((item) => item.in_stock) || product.variants[0];
  return {
    variant_id: variant.id,
    quantity: 1,
    product: { id: product.id, name: product.name, slug: product.slug, image: product.images?.[0]?.url || null },
    sku: variant.sku,
    unit_price: variant.price,
    compare_at_price: variant.compare_at_price,
    stock_quantity: variant.stock_quantity,
  };
}

export async function openPdp(page, slug) {
  await page.goto(`/p/${slug}`);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
}

/** Adds the PDP's current variant (optionally choosing a phone model) and waits for the confirmation. */
export async function addToCartFromPdp(page, slug, model) {
  await openPdp(page, slug);
  if (model) {
    const option = page.getByRole('group', { name: 'Phone Model' }).getByRole('button', { name: model, exact: true });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
  }
  const sku = (await page.getByText(/^SKU /).last().innerText()).replace(/^SKU /, '').trim();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('button', { name: 'Added to cart' })).toBeVisible();
  return { sku };
}
