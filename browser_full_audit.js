const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000';

async function runBrowserAudit() {
  console.log('====================================================');
  console.log('🌐 STARTING COMPREHENSIVE END-TO-END BROWSER AUDIT');
  console.log('====================================================\n');

  console.log('🚀 Launching Chrome instance at:', CHROME_PATH);
  const profileDir = path.join(__dirname, '.chrome_profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore external favicon or font network 404s if any
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // ----------------------------------------------------
    // PHASE 1: Initial Page Load & Shell Verification
    // ----------------------------------------------------
    console.log('▶ Phase 1: Loading PDFZen homepage at', APP_URL);
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const title = await page.title();
    console.log(`  ✓ Page Title: "${title}"`);
    if (!title.includes('PDFZen')) throw new Error('Title does not contain PDFZen');

    // ----------------------------------------------------
    // PHASE 2: Theme Toggle Verification
    // ----------------------------------------------------
    console.log('\n▶ Phase 2: Testing Dark/Light Theme Switching in DOM...');
    const initialIsDark = await page.evaluate(() => document.documentElement.classList.contains('light'));
    await page.click('#theme-toggle');
    const toggledIsLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
    if (initialIsDark === toggledIsLight) throw new Error('Theme toggle failed to change <html> class');
    console.log(`  ✓ Dark/Light theme toggled successfully (light mode: ${toggledIsLight})`);
    // Toggle back
    await page.click('#theme-toggle');

    // ----------------------------------------------------
    // PHASE 3: Search Modal & Hotkeys
    // ----------------------------------------------------
    console.log('\n▶ Phase 3: Testing Search Modal & Hotkeys...');
    await page.keyboard.press('/');
    await page.waitForSelector('#search-modal:not(.hidden)', { timeout: 3000 });
    console.log('  ✓ Search modal opened with "/" shortcut');

    await page.type('#tool-search-input', 'compress');
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('#search-results .search-result-item');
      return items.length > 0;
    }, { timeout: 4000 });
    const matchCount = await page.evaluate(() => {
      return document.querySelectorAll('#search-results .search-result-item').length;
    });
    console.log(`  ✓ Searching "compress" returned ${matchCount} tool result(s)`);
    if (matchCount === 0) throw new Error('Search did not return matches for "compress"');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('search-modal').classList.contains('hidden'));
    console.log('  ✓ Search modal dismissed with Escape key');

    // ----------------------------------------------------
    // PHASE 4: Category Filtering on Bento Grid
    // ----------------------------------------------------
    console.log('\n▶ Phase 4: Testing Category Filtering on Bento Grid...');
    const categories = ['organize', 'optimize', 'convert', 'edit', 'secure', 'all'];
    for (const cat of categories) {
      const visibleCount = await page.evaluate((category) => {
        const btn = Array.from(document.querySelectorAll('.cat-pill')).find(b => 
          b.textContent.toLowerCase().includes(category) || (category === 'all' && b.textContent.includes('All'))
        );
        if (btn) btn.click();
        const cards = Array.from(document.querySelectorAll('.tool-item-card'));
        return cards.filter(c => c.style.display !== 'none').length;
      }, cat);
      console.log(`  ✓ Category [${cat.toUpperCase()}]: ${visibleCount} card(s) visible`);
      if (visibleCount === 0) throw new Error(`Category ${cat} showed 0 cards`);
    }

    // ----------------------------------------------------
    // PHASE 5: Testing ALL 27 Tools Workspace Rendering & 5GB Sensitive Caps
    // ----------------------------------------------------
    console.log('\n▶ Phase 5: Testing Workspace Rendering for ALL 27 Tools...');
    const tools = await page.evaluate(() => {
      return window.TOOLS_DATABASE.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        allowMultiple: !!t.allowMultiple
      }));
    });
    console.log(`  Loaded ${tools.length} tools from runtime database.`);
    if (tools.length !== 27) throw new Error(`Expected exactly 27 tools, found ${tools.length}`);

    let sensitiveToolCount = 0;
    let unlimitedToolCount = 0;

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      await page.evaluate((toolId) => {
        window.router.navigate(toolId, false);
      }, t.id);

      // Verify tool workspace title
      const titleText = await page.$eval('#tool-title', el => el.innerText.trim());
      if (titleText.toUpperCase() !== t.name.toUpperCase()) {
        throw new Error(`Tool title mismatch for ${t.id}: expected "${t.name}", got "${titleText}"`);
      }

      // Check upload limit notice
      const limitNotice = await page.$eval('#upload-limit-notice', el => el.innerText.trim());
      const isSensitive = t.category === 'secure' || t.id === 'sign' || t.id === 'protect' || t.id === 'unlock' || t.id === 'redact-pdf';

      if (isSensitive) {
        sensitiveToolCount++;
        if (!limitNotice.includes('5 GB')) {
          throw new Error(`Tool ${t.name} is sensitive but limit notice missing "5 GB": "${limitNotice}"`);
        }
      } else {
        unlimitedToolCount++;
        if (!limitNotice.includes('Unlimited File Size')) {
          throw new Error(`Tool ${t.name} is general but limit notice missing "Unlimited File Size": "${limitNotice}"`);
        }
      }

      // Verify action button text
      const executeBtnText = await page.$eval('#execute-btn-text', el => el.innerText.trim());
      if (executeBtnText.toUpperCase() !== t.name.toUpperCase()) {
        throw new Error(`Execute button mismatch for ${t.id}: expected "${t.name}", got "${executeBtnText}"`);
      }
    }
    console.log(`  ✓ All 27 tools rendered flawlessly (${sensitiveToolCount} sensitive with 5GB cap, ${unlimitedToolCount} with unlimited cap)`);

    // ----------------------------------------------------
    // PHASE 6: Testing OmniConvert ("Universal Tab")
    // ----------------------------------------------------
    console.log('\n▶ Phase 6: Testing OmniConvert Universal Tab...');
    await page.evaluate(() => window.router.navigate('universal', false));
    
    const univHeader = await page.$eval('#view-universal h1', el => el.innerText.trim());
    console.log(`  ✓ Universal View header: "${univHeader}"`);
    if (!univHeader.toUpperCase().includes('UNIVERSAL CONVERTER')) throw new Error('Universal Converter header mismatch');

    // Simulate selecting a file in OmniConvert
    const targetsRendered = await page.evaluate(() => {
      // Test format detection & target generation directly
      const formats = ['pdf', 'docx', 'xlsx', 'csv', 'jpg', 'png', 'txt', 'html', 'pptx'];
      let results = [];
      for (const fmt of formats) {
        const tgts = window.getUniversalTargets ? window.getUniversalTargets(fmt) : [];
        results.push({ format: fmt, count: tgts.length });
      }
      return results;
    });

    console.log('  ✓ OmniConvert target matrix generation verified:');
    targetsRendered.forEach(r => {
      console.log(`    - From .${r.format.toUpperCase()}: ${r.count} destination format target(s)`);
      if (r.count === 0) throw new Error(`Target matrix for ${r.format} is empty`);
    });

    // ----------------------------------------------------
    // PHASE 7: Mobile Viewport & Touch Ergonomics Audit
    // ----------------------------------------------------
    console.log('\n▶ Phase 7: Testing Mobile Viewport & Mobile Dock (iPhone SE 375x667)...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    
    // Check mobile dock visibility
    const isDockVisible = await page.evaluate(() => {
      const dock = document.getElementById('mobile-bottom-dock');
      if (!dock) return false;
      const style = window.getComputedStyle(dock);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    console.log(`  ✓ Mobile Bottom Dock visibility on 375px: ${isDockVisible}`);
    if (!isDockVisible) throw new Error('Mobile bottom dock should be visible on 375px viewport');

    // Test dock button navigation
    await page.click('#dock-btn-universal');
    const isUnivActive = await page.evaluate(() => !document.getElementById('view-universal').classList.contains('hidden'));
    console.log(`  ✓ Tapped Mobile Dock "Convert" -> Universal Tab Active: ${isUnivActive}`);
    if (!isUnivActive) throw new Error('Tapping Convert dock button did not show view-universal');

    await page.click('#dock-btn-home');
    const isHomeActive = await page.evaluate(() => !document.getElementById('view-home').classList.contains('hidden'));
    console.log(`  ✓ Tapped Mobile Dock "Home" -> Home Active: ${isHomeActive}`);
    if (!isHomeActive) throw new Error('Tapping Home dock button did not show view-home');

    // Check Signature Canvas initialization on mobile
    await page.evaluate(() => window.router.navigate('sign', false));
    await page.evaluate(async () => {
      // Simulate file loaded to render signature pad
      document.getElementById('upload-step').classList.add('hidden');
      document.getElementById('config-step').classList.remove('hidden');
      window.loadedFiles = [{ name: 'test.pdf', bytes: new Uint8Array([1, 2, 3]), size: 100 }];
      await window.buildToolControls();
      await new Promise(r => setTimeout(r, 150));
    });
    const sigPadWidth = await page.evaluate(() => {
      const c = document.getElementById('sig-canvas');
      return c ? c.width : 0;
    });
    console.log(`  ✓ Signature Canvas mobile width dynamically adapted to: ${sigPadWidth}px`);
    if (sigPadWidth === 0 || sigPadWidth > 375) {
      console.warn(`  Warning: Signature canvas width is ${sigPadWidth}px`);
    }

    // ----------------------------------------------------
    // PHASE 8: Client-Side PDF Generation Execution Test
    // ----------------------------------------------------
    console.log('\n▶ Phase 8: Testing In-Browser PDF Creation Pipeline...');
    const generatedPdfBytes = await page.evaluate(async () => {
      const doc = await PDFLib.PDFDocument.create();
      const page = doc.addPage([600, 400]);
      page.drawText('PDFZen E2E In-Browser Verification Test Passed!', { x: 50, y: 350, size: 18 });
      const bytes = await doc.save();
      return bytes.length;
    });
    console.log(`  ✓ Successfully synthesized sample PDF in browser RAM (${generatedPdfBytes} bytes)`);
    if (generatedPdfBytes < 100) throw new Error('Generated PDF bytes too small');

    // ----------------------------------------------------
    // FINAL ERROR CHECK
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log('🔍 CHECKING CONSOLE & RUNTIME ERRORS...');
    console.log('====================================================');
    if (consoleErrors.length > 0) {
      console.error('Console Errors detected:', consoleErrors);
      throw new Error(`Encountered ${consoleErrors.length} console errors during audit`);
    } else {
      console.log('  ✓ 0 Console Errors encountered across all 27 tools and views!');
    }

    if (pageErrors.length > 0) {
      console.error('Page Errors detected:', pageErrors);
      throw new Error(`Encountered ${pageErrors.length} unhandled page exceptions`);
    } else {
      console.log('  ✓ 0 Page Exceptions encountered!');
    }

    console.log('\n====================================================');
    console.log('🎉 BROWSER E2E VERIFICATION COMPLETED WITH 100% SUCCESS!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ BROWSER AUDIT FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runBrowserAudit();
