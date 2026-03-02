/**
 * E2E Tests for IDsecure Application
 * Tests the complete user flow from login to search
 */
import { test, expect } from '@playwright/test';

test.describe('IDsecure Application', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test.describe('Authentication', () => {
    test('should show login page when not authenticated', async ({ page }) => {
      // Check if we're redirected to login or see login form
      await expect(page).toHaveURL(/.*auth.*/);
      
      // Verify login form elements exist
      await expect(page.locator('input[type="text"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      // Navigate to auth page if not already there
      await page.goto('/auth/signin');
      
      // Fill in credentials
      await page.locator('input[type="text"]').fill('admin');
      await page.locator('input[type="password"]').fill('idsecure2026');
      
      // Submit form
      await page.locator('button[type="submit"]').click();
      
      // Wait for navigation
      await page.waitForURL('/');
      
      // Verify we're on the main page
      await expect(page.locator('h1')).toContainText('Social Intelligence Engine');
    });
  });

  test.describe('Main Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/auth/signin');
      await page.locator('input[type="text"]').fill('admin');
      await page.locator('input[type="password"]').fill('idsecure2026');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('/');
    });

    test('should display main dashboard elements', async ({ page }) => {
      // Verify header
      await expect(page.locator('h1')).toContainText('Social Intelligence Engine');
      
      // Verify navigation tabs
      await expect(page.locator('button:has-text("Search")')).toBeVisible();
      await expect(page.locator('button:has-text("Analytics")')).toBeVisible();
      await expect(page.locator('button:has-text("Graph")')).toBeVisible();
      await expect(page.locator('button:has-text("Risk")')).toBeVisible();
      
      // Verify search form
      await expect(page.locator('input[placeholder*="John Doe"]')).toBeVisible();
      await expect(page.locator('input[placeholder*="email"]')).toBeVisible();
    });

    test('should switch between views', async ({ page }) => {
      // Click Analytics tab
      await page.locator('button:has-text("Analytics")').click();
      await expect(page.locator('text=Analytics')).toBeVisible();
      
      // Click Graph tab
      await page.locator('button:has-text("Graph")').click();
      await expect(page.locator('text=Graph')).toBeVisible();
      
      // Click Risk tab
      await page.locator('button:has-text("Risk")').click();
      await expect(page.locator('text=Risk')).toBeVisible();
    });

    test('should validate search form', async ({ page }) => {
      // Try to search without any input
      const searchButton = page.locator('button:has-text("Execute Search")');
      await expect(searchButton).toBeDisabled();
      
      // Fill in name
      await page.locator('input[placeholder*="John Doe"]').fill('Test User');
      
      // Search button should now be enabled
      await expect(searchButton).toBeEnabled();
    });
  });

  test.describe('Search Functionality', () => {
    test('should execute search and show results', async ({ page }) => {
      // Login
      await page.goto('/auth/signin');
      await page.locator('input[type="text"]').fill('admin');
      await page.locator('input[type="password"]').fill('idsecure2026');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('/');
      
      // Fill in search form
      await page.locator('input[placeholder*="John Doe"]').fill('Elon Musk');
      
      // Execute search
      await page.locator('button:has-text("Execute Search")').click();
      
      // Wait for search to start (progress indicator)
      await expect(page.locator('text=Analyzing')).toBeVisible({ timeout: 5000 });
      
      // Note: Actual results depend on API availability
      // This test verifies the search flow starts correctly
    });
  });
});
