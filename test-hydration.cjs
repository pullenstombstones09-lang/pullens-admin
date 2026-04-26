const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[ERROR] ${err.message}`));

  // Login
  await page.goto('https://pullens-admin.vercel.app/login', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Annika")').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("4")').click();
  await page.locator('button:has-text("6")').click();
  await page.locator('button:has-text("8")').click();
  await page.locator('button:has-text("2")').click();
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForTimeout(3000);

  // Now inject debug code to check what AuthProvider sees
  const result = await page.evaluate(async () => {
    // Decode the cookie to see the token
    const cookies = document.cookie;
    const authCookie = cookies.split(';').find(c => c.trim().startsWith('sb-'));

    // Try creating a Supabase client and checking session
    // We'll just decode the cookie value
    let tokenInfo = 'no auth cookie';
    if (authCookie) {
      const value = authCookie.split('=').slice(1).join('=').trim();
      try {
        // base64 encoded JSON
        const decoded = atob(value.replace('base64-', ''));
        const parsed = JSON.parse(decoded);
        tokenInfo = {
          hasAccessToken: !!parsed.access_token,
          hasRefreshToken: !!parsed.refresh_token,
          userId: parsed.user?.id || 'none',
          userEmail: parsed.user?.email || 'none',
          expiresAt: parsed.expires_at,
        };
      } catch (e) {
        tokenInfo = 'decode failed: ' + e.message;
      }
    }

    return { cookies: document.cookie.substring(0, 200), tokenInfo };
  });

  console.log('Cookie:', result.cookies);
  console.log('Token info:', JSON.stringify(result.tokenInfo, null, 2));

  console.log('\nConsole logs:');
  logs.forEach(l => console.log(' ', l));

  await browser.close();
})();
