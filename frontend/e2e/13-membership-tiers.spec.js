import { test, expect } from '@playwright/test';

const tiers = [
  { packageId: 10, membershipTier: 'SILVER', name: 'Hạng Bạc', price: 800000, quotaSessions: 10, quotaCourts: 5, accessType: 'OFF_PEAK' },
  { packageId: 11, membershipTier: 'GOLD', name: 'Hạng Vàng', price: 1500000, quotaSessions: 20, quotaCourts: 10, accessType: 'ALL_DAY' },
  { packageId: 12, membershipTier: 'DIAMOND', name: 'Hạng Kim Cương', price: 2800000, quotaSessions: 30, quotaCourts: 15, accessType: 'ALL_DAY' },
].map((tier) => ({ ...tier, durationDays: 30, status: 'ACTIVE', description: 'Quyền lợi theo hạng hội viên' }));

test('member catalog shows three tiers with actual session and court entitlements', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('sports-center-auth-session', JSON.stringify({
    token: 'tier-ui-test', role: 'member', user: { id: 9, name: 'Hội viên', role: 'MEMBER' },
  })));
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path.endsWith('/packages') ? tiers : [] });
  });
  await page.goto('/member/packages');
  await expect(page.getByRole('heading', { name: 'Hạng hội viên & quyền lợi', exact: true })).toBeVisible();
  for (const tier of tiers) {
    await expect(page.getByRole('heading', { name: tier.name, exact: true })).toBeVisible();
    await expect(page.getByText(`${tier.quotaSessions} buổi lớp học hoặc PT / kỳ`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${tier.quotaCourts} giờ sân / kỳ`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Giờ thấp điểm 08:00–16:00', { exact: true })).toBeVisible();
  await expect(page.getByText('Tập luyện không giới hạn các sân tập tiêu chuẩn', { exact: true })).toHaveCount(0);
});

test('manager can create Bronze during the demo without the standalone PT catalog', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('sports-center-auth-session', JSON.stringify({
    token: 'tier-ui-test', role: 'admin', user: { id: 1, name: 'Quản lý', role: 'MANAGER' },
  })));
  const catalog = [...tiers];
  let createdPayload;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/packages') && route.request().method() === 'POST') {
      createdPayload = route.request().postDataJSON();
      catalog.push({ ...createdPayload, packageId: 13 });
      await route.fulfill({ json: catalog.at(-1) });
    } else await route.fulfill({ json: path.endsWith('/packages') ? catalog : [] });
  });
  await page.goto('/admin/packages');
  await expect(page.getByRole('heading', { name: 'Hạng Hội Viên & Quyền Lợi', exact: true })).toBeVisible();
  await expect(page.getByText('Hạng Bạc', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bảng giá PT lẻ theo Coach/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Thêm hạng hội viên/ }).click();
  const select = page.getByLabel('Hạng hội viên', { exact: true });
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveText(['Gói cũ lưu lịch sử', 'Đồng', 'Bạc', 'Vàng', 'Kim Cương']);
  await expect(select).toHaveValue('BRONZE');
  await expect(page.getByLabel('Giá niêm yết', { exact: true })).toHaveValue('400000');
  await page.getByRole('button', { name: 'Lưu hạng hội viên', exact: true }).click();
  await expect(page.getByText('Hạng Đồng', { exact: true })).toBeVisible();
  expect(createdPayload).toMatchObject({ membershipTier: 'BRONZE', name: 'Hạng Đồng', price: 400000, durationDays: 30, quotaSessions: 5, quotaCourts: 2, accessType: 'OFF_PEAK' });
});
