import { chromium } from 'playwright';

const BASE = 'https://pullens-admin.vercel.app';
const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '[PASS]' : status === 'WARN' ? '[WARN]' : '[FAIL]';
  const msg = `${icon} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ test, status, detail });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  try {
    // === LOGIN ===
    console.log('\n=== LOGIN PAGE ===');
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    const title = await page.textContent('h1');
    log('Login page loads', title?.includes('PULLENS') ? 'PASS' : 'FAIL', title);

    const userLinks = await page.locator('a[href*="/api/auth/login"]').count();
    log('All 6 user buttons', userLinks === 6 ? 'PASS' : 'FAIL', `Found ${userLinks}`);

    // Test hover classes exist (Tailwind compiled)
    const firstBtn = page.locator('a[href*="/api/auth/login"]').first();
    const btnClass = await firstBtn.getAttribute('class');
    log('Login buttons have hover styles', btnClass?.includes('hover:') ? 'PASS' : 'WARN');

    // === AUTH ===
    console.log('\n=== AUTH FLOW ===');
    await page.click('a[href="/api/auth/login?name=Annika"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    log('Login → dashboard redirect', 'PASS');

    // === DASHBOARD ===
    console.log('\n=== DASHBOARD ===');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const mainContent = await page.locator('main').textContent();
    log('Welcome message', mainContent?.includes('Annika') ? 'PASS' : 'FAIL');
    log('Logo visible', await page.locator('img[alt="Pullens Tombstones"]').count() > 0 ? 'PASS' : 'FAIL');

    // Stat cards — check for labels
    for (const label of ['Staff present', 'Outstanding alerts', 'Petty cash', 'Payroll status']) {
      const found = mainContent?.includes(label);
      log(`Stat card: ${label}`, found ? 'PASS' : 'FAIL');
    }

    // Quick actions
    for (const href of ['/register', '/payroll', '/petty-cash', '/hr-advisor']) {
      const link = await page.locator(`main a[href="${href}"]`).count();
      log(`Quick action: ${href}`, link > 0 ? 'PASS' : 'FAIL');
    }

    // === NAVIGATE ALL PAGES ===
    console.log('\n=== PAGE NAVIGATION ===');
    const pages = [
      { path: '/staff', name: 'Staff' },
      { path: '/register', name: 'Register' },
      { path: '/payroll', name: 'Payroll' },
      { path: '/petty-cash', name: 'Petty Cash' },
      { path: '/hr-advisor', name: 'HR Advisor' },
      { path: '/alerts', name: 'Alerts' },
      { path: '/exports', name: 'Exports' },
      { path: '/settings', name: 'Settings' },
    ];

    for (const pg of pages) {
      try {
        const resp = await page.goto(BASE + pg.path, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(1000);
        const status = resp?.status();
        const bodyLen = (await page.locator('main').textContent())?.length || 0;
        if (status >= 500) {
          log(`${pg.name} page`, 'FAIL', `HTTP ${status}`);
        } else if (bodyLen < 20) {
          log(`${pg.name} page`, 'WARN', 'Very little content rendered');
        } else {
          log(`${pg.name} page`, 'PASS', `HTTP ${status}, ${bodyLen} chars`);
        }
      } catch (err) {
        log(`${pg.name} page`, 'FAIL', err.message.slice(0, 80));
      }
    }

    // === STAFF LIST ===
    console.log('\n=== STAFF LIST ===');
    await page.goto(BASE + '/staff', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const ptCodes = await page.locator('text=/PT\\d{3}/').count();
    log('Employee cards rendered', ptCodes > 0 ? 'PASS' : 'FAIL', `${ptCodes} employees`);

    const searchInput = await page.locator('input[placeholder*="earch"]').count();
    log('Search input', searchInput > 0 ? 'PASS' : 'FAIL');

    // Search test
    if (searchInput > 0) {
      await page.fill('input[placeholder*="earch"]', 'Marlyn');
      await page.waitForTimeout(500);
      const filtered = await page.locator('text=/PT\\d{3}/').count();
      log('Search filters results', filtered < ptCodes ? 'PASS' : 'WARN', `${filtered} shown after search`);
      await page.fill('input[placeholder*="earch"]', '');
    }

    // === EMPLOYEE PROFILE ===
    console.log('\n=== EMPLOYEE PROFILE ===');
    await page.goto(BASE + '/staff', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Try clicking first employee card
    const empCard = page.locator('[class*="cursor-pointer"]').first();
    if (await empCard.count() > 0) {
      await empCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const profileContent = await page.locator('main').textContent();
      log('Profile page loads', profileContent && profileContent.length > 100 ? 'PASS' : 'FAIL');

      // Check for photo upload area
      const photoBtn = await page.locator('[title*="photo"], [title*="Photo"]').count();
      log('Photo upload button', photoBtn > 0 ? 'PASS' : 'WARN');

      // Check for back button
      const backBtn = await page.locator('text=/Back|back|←/').count();
      log('Back navigation', backBtn > 0 ? 'PASS' : 'WARN');
    } else {
      log('Employee card click', 'WARN', 'No clickable cards found');
    }

    // === REGISTER ===
    console.log('\n=== REGISTER ===');
    await page.goto(BASE + '/register', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const statusDropdowns = await page.locator('select').count();
    log('Status dropdowns', statusDropdowns > 0 ? 'PASS' : 'WARN', `${statusDropdowns} dropdowns`);

    // Check save button
    const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Update")').count();
    log('Save/Update button', saveBtn > 0 ? 'PASS' : 'WARN');

    // === PAYROLL ===
    console.log('\n=== PAYROLL ===');
    await page.goto(BASE + '/payroll', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const calcBtn = await page.locator('button:has-text("Calculate"), button:has-text("Run")').count();
    log('Calculate button', calcBtn > 0 ? 'PASS' : 'WARN');

    // Week selector
    const weekNav = await page.locator('button:has-text("←"), button:has-text("Previous"), button[aria-label*="prev"]').count();
    log('Week navigation', weekNav > 0 ? 'PASS' : 'WARN');

    // === PETTY CASH ===
    console.log('\n=== PETTY CASH ===');
    await page.goto(BASE + '/petty-cash', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const balanceText = await page.locator('main').textContent();
    log('Balance displayed', balanceText?.includes('R') ? 'PASS' : 'WARN');

    // Tabs
    const tabs = await page.locator('button:has-text("Cash Out"), button:has-text("History")').count();
    log('Petty cash tabs', tabs > 0 ? 'PASS' : 'WARN');

    // === SIDEBAR ===
    console.log('\n=== SIDEBAR ===');
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });

    // Use first (desktop) aside only
    const desktopSidebar = page.locator('aside').first();
    const sidebarText = await desktopSidebar.textContent();
    log('Sidebar shows user name', sidebarText?.includes('Annika') ? 'PASS' : 'FAIL');
    log('Sidebar has logout', sidebarText?.includes('Logout') ? 'PASS' : 'FAIL');

    const navLinks = await desktopSidebar.locator('a[href]').count();
    log('Sidebar nav links', navLinks >= 5 ? 'PASS' : 'FAIL', `${navLinks} links`);

    // Active state (gold highlight on dashboard)
    const activeLink = await desktopSidebar.locator('a[class*="C4A35A"]').count();
    log('Active link highlighted', activeLink > 0 ? 'PASS' : 'WARN');

    // === MOBILE ===
    console.log('\n=== MOBILE VIEW ===');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const menuBtn = await page.locator('button[aria-label="Open menu"]').count();
    log('Mobile menu button', menuBtn > 0 ? 'PASS' : 'FAIL');

    if (menuBtn > 0) {
      await page.click('button[aria-label="Open menu"]');
      await page.waitForTimeout(500);

      // Check close button appears
      const closeBtn = await page.locator('button[aria-label="Close menu"]').count();
      log('Mobile sidebar close button', closeBtn > 0 ? 'PASS' : 'WARN');

      // Close it
      if (closeBtn > 0) {
        await page.click('button[aria-label="Close menu"]');
        await page.waitForTimeout(300);
      }
    }

    // Check mobile header has gold accent
    const mobileHeader = page.locator('header');
    const headerClass = await mobileHeader.getAttribute('class');
    log('Mobile header gold accent', headerClass?.includes('C4A35A') ? 'PASS' : 'WARN');

    // === RESPONSIVE CARDS ===
    // Check stat cards stack on mobile
    const cardCount = await page.locator('main [class*="rounded-xl"][class*="bg-white"]').count();
    log('Cards render on mobile', cardCount > 0 ? 'PASS' : 'FAIL', `${cardCount} cards`);

    // === LOGOUT ===
    console.log('\n=== LOGOUT ===');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
    const logoutBtn = page.locator('aside').first().locator('button:has-text("Logout")');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.click();
      await page.waitForTimeout(2000);
      log('Logout redirects', page.url().includes('login') ? 'PASS' : 'WARN', page.url());
    }

    // === JS ERRORS ===
    console.log('\n=== JS ERRORS ===');
    if (jsErrors.length === 0) {
      log('No JS errors', 'PASS');
    } else {
      jsErrors.forEach(e => log('JS Error', 'WARN', e.slice(0, 120)));
    }

  } catch (err) {
    log('Test runner', 'FAIL', err.message.slice(0, 120));
  }

  // Summary
  console.log('\n=============================');
  console.log('=== RESULTS SUMMARY ===');
  console.log('=============================');
  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`PASS: ${pass} | WARN: ${warn} | FAIL: ${fail} | Total: ${results.length}`);

  if (fail > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
  }
  if (warn > 0) {
    console.log('\nWARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
  }

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
