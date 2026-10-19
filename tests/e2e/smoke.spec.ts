import { test, expect } from "@playwright/test";

test.describe("Public pages & layout", () => {
  test("landing page renders headline and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Our Cousin Family/i);

    // Assert branding or sign in link is present
    const signInLinks = page.locator('a[href*="/login"]');
    await expect(signInLinks.first()).toBeVisible();

    // Verify no horizontal overflow
    const hasNoHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 1; // 1px rounding tolerance
    });
    expect(hasNoHorizontalOverflow).toBe(true);
  });

  test("login page renders form fields and actions", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check no horizontal overflow
    const hasNoHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 1;
    });
    expect(hasNoHorizontalOverflow).toBe(true);
  });

  test("signup page renders registration form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    const hasNoHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 1;
    });
    expect(hasNoHorizontalOverflow).toBe(true);
  });

  test("forgot password page renders request form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("join page renders invitation code entry", async ({ page }) => {
    await page.goto("/join");
    await expect(page.locator("input")).toBeVisible();
  });
});

test.describe("Route guards (unauthenticated access)", () => {
  const protectedRoutes = ["/home", "/chat", "/calendar", "/vault", "/ludo", "/calls", "/settings"];

  for (const route of protectedRoutes) {
    test(`redirects unauthenticated visitor from ${route} to login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

