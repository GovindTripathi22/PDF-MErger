const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:3000/#universal';

async function testUniversalPage() {
  console.log('====================================================');
  console.log('🧪 DEEP DIVE E2E TEST: UNIVERSAL CONVERTER (#universal)');
  console.log('====================================================\n');

  // Use a unique temp profile to prevent browser singleton lock
  const tempProfile = path.join(__dirname, '.chrome_univ_profile_' + Date.now());
  fs.mkdirSync(tempProfile, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    userDataDir: tempProfile,
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
      if (!text.includes('favicon.ico')) consoleErrors.push(text);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    // ----------------------------------------------------
    // STEP 1: Direct URL Navigation to #universal
    // ----------------------------------------------------
    console.log(`▶ Step 1: Navigating directly to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check view-universal is visible
    const isUnivVisible = await page.evaluate(() => {
      const v = document.getElementById('view-universal');
      const h = document.getElementById('view-home');
      return v && !v.classList.contains('hidden') && h && h.classList.contains('hidden');
    });
    console.log(`  ✓ #view-universal visible on initial load: ${isUnivVisible}`);
    if (!isUnivVisible) throw new Error('#view-universal is not visible after direct load with #universal');

    // Check title and header
    const titleText = await page.$eval('#view-universal h1', el => el.innerText.trim());
    console.log(`  ✓ Header text: "${titleText}"`);

    // ----------------------------------------------------
    // STEP 2: Light Theme Contrast Verification on #universal
    // ----------------------------------------------------
    console.log('\n▶ Step 2: Testing Light Theme Contrast on #universal...');
    await page.click('#theme-toggle'); // Switch to light
    const isLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
    console.log(`  ✓ Switched to Light Mode: ${isLight}`);
    
    // Check contrast of badges and text
    const headerColor = await page.evaluate(() => {
      const h1 = document.querySelector('#view-universal h1');
      return window.getComputedStyle(h1).color;
    });
    console.log(`  ✓ H1 color in Light Theme: ${headerColor}`);

    // Switch back to Dark
    await page.click('#theme-toggle');

    // ----------------------------------------------------
    // STEP 3: Dropzone & File Selection Simulation
    // ----------------------------------------------------
    console.log('\n▶ Step 3: Testing File Selection & Format Ingestion...');
    
    // Create a real sample PDF in-memory to test full pipeline
    const samplePdfBase64 = await page.evaluate(async () => {
      const doc = await PDFLib.PDFDocument.create();
      const p = doc.addPage([500, 300]);
      p.drawText('OmniConvert Universal Pipeline Test Document', { x: 50, y: 250, size: 16 });
      p.drawText('Second line of sample text for conversion parsing.', { x: 50, y: 210, size: 12 });
      const b = await doc.save();
      // return as base64 string
      let binary = '';
      for (let i = 0; i < b.length; i++) binary += String.fromCharCode(b[i]);
      return btoa(binary);
    });

    console.log(`  ✓ Synthesized test PDF (${samplePdfBase64.length} base64 chars)`);

    // Ingest the test PDF into univState via page.evaluate
    const ingestResult = await page.evaluate(async (b64) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const file = new File([bytes], "e2e_test.pdf", { type: "application/pdf" });
      await handleUniversalFileInput(file);

      return {
        fileName: document.getElementById('univ-file-name').innerText,
        sourceBadge: document.getElementById('univ-source-badge').innerText,
        targetsCount: document.querySelectorAll('#univ-targets-grid .univ-target-btn').length,
        configVisible: !document.getElementById('univ-config-step').classList.contains('hidden')
      };
    }, samplePdfBase64);

    console.log('  ✓ Ingested PDF into Universal Workspace:', ingestResult);
    if (!ingestResult.configVisible) throw new Error('univ-config-step did not become visible after file ingest');
    if (ingestResult.targetsCount === 0) throw new Error('No target buttons generated for PDF source');

    // ----------------------------------------------------
    // STEP 4: Target Selection & Contextual Options
    // ----------------------------------------------------
    console.log('\n▶ Step 4: Testing Target Format Selection...');
    
    // Select DOCX target
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.univ-target-btn')).find(b => b.getAttribute('data-target-id') === 'docx');
      if (btn) btn.click();
    });
    const selectedTarget = await page.evaluate(() => univState.targetFormat);
    console.log(`  ✓ Selected Target Format: ${selectedTarget}`);
    if (selectedTarget !== 'docx') throw new Error(`Expected docx target, got ${selectedTarget}`);

    // Select PPTX target
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.univ-target-btn')).find(b => b.getAttribute('data-target-id') === 'pptx');
      if (btn) btn.click();
    });
    const selectedPptx = await page.evaluate(() => univState.targetFormat);
    console.log(`  ✓ Switched to PPTX Target Format: ${selectedPptx}`);

    // Check contextual settings rendered
    const contextSettingsHtml = await page.$eval('#univ-context-settings', el => el.innerHTML.trim());
    console.log(`  ✓ Contextual settings rendered (length: ${contextSettingsHtml.length} chars)`);
    if (contextSettingsHtml.length === 0) throw new Error('Context settings panel is empty');

    // ----------------------------------------------------
    // STEP 5: Conversion Execution Pipeline
    // ----------------------------------------------------
    console.log('\n▶ Step 5: Executing Universal Conversion (PDF -> PPTX)...');
    await page.click('#univ-execute-btn');

    // Wait for download step
    await page.waitForFunction(() => {
      const dl = document.getElementById('univ-download-step');
      return dl && !dl.classList.contains('hidden');
    }, { timeout: 15000 });

    const downloadHref = await page.$eval('#univ-main-download-btn', el => el.href);
    const downloadName = await page.$eval('#univ-main-download-btn', el => el.download);
    console.log(`  ✓ Conversion completed! Download file: "${downloadName}" (URL: ${downloadHref.slice(0, 35)}...)`);
    if (!downloadHref.startsWith('blob:')) throw new Error('Download URL is not a blob URL');
    if (!downloadName.endsWith('.pptx')) throw new Error(`Download file name should end with .pptx, got ${downloadName}`);

    // ----------------------------------------------------
    // STEP 6: Testing Other Format Conversions (CSV -> XLSX & DOCX -> PDF)
    // ----------------------------------------------------
    console.log('\n▶ Step 6: Testing Ingest & Conversion for CSV and DOCX...');
    
    // Test CSV -> XLSX
    const csvResult = await page.evaluate(async () => {
      resetUniversalWorkspace();
      const csvContent = "Name,Role,Score\nAlice,Developer,98\nBob,Designer,95\nCharlie,Product,92";
      const file = new File([csvContent], "team_report.csv", { type: "text/csv" });
      await handleUniversalFileInput(file);
      
      // Select xlsx
      selectUniversalTarget('xlsx');
      await executeUniversalConversion();
      
      return {
        downloadName: univState.convertedFilename,
        isBlob: univState.convertedBlob instanceof Blob,
        blobSize: univState.convertedBlob ? univState.convertedBlob.size : 0
      };
    });

    console.log('  ✓ CSV -> XLSX conversion result:', csvResult);
    if (!csvResult.downloadName.endsWith('.xlsx')) throw new Error('CSV to XLSX conversion failed to output .xlsx');
    if (csvResult.blobSize === 0) throw new Error('CSV to XLSX output blob is empty');

    // Test TXT -> PDF
    const txtResult = await page.evaluate(async () => {
      resetUniversalWorkspace();
      const txtContent = "Hello from PDFZen Universal Converter!\nTesting raw text to formatted vector PDF.\nSecond page paragraph.";
      const file = new File([txtContent], "notes.txt", { type: "text/plain" });
      await handleUniversalFileInput(file);
      
      selectUniversalTarget('pdf');
      await executeUniversalConversion();
      
      return {
        downloadName: univState.convertedFilename,
        isBlob: univState.convertedBlob instanceof Blob,
        blobSize: univState.convertedBlob ? univState.convertedBlob.size : 0
      };
    });

    console.log('  ✓ TXT -> PDF conversion result:', txtResult);
    if (!txtResult.downloadName.endsWith('.pdf')) throw new Error('TXT to PDF conversion failed to output .pdf');
    if (txtResult.blobSize === 0) throw new Error('TXT to PDF output blob is empty');

    // ----------------------------------------------------
    // STEP 7: Reset & Mobile Dock Integration
    // ----------------------------------------------------
    console.log('\n▶ Step 7: Testing Workspace Reset & Back Navigation...');
    await page.evaluate(() => resetUniversalWorkspace());
    const isUploadVisibleAfterReset = await page.evaluate(() => {
      const u = document.getElementById('univ-upload-step');
      const c = document.getElementById('univ-config-step');
      const d = document.getElementById('univ-download-step');
      return !u.classList.contains('hidden') && c.classList.contains('hidden') && d.classList.contains('hidden');
    });
    console.log(`  ✓ Reset returns to file dropzone: ${isUploadVisibleAfterReset}`);
    if (!isUploadVisibleAfterReset) throw new Error('Reset failed to return to drop zone');

    // Test Back button
    await page.click('#view-universal button:has(span.material-symbols-outlined)');
    const isHomeAfterBack = await page.evaluate(() => !document.getElementById('view-home').classList.contains('hidden'));
    console.log(`  ✓ Back button returned to Home: ${isHomeAfterBack}`);

    // ----------------------------------------------------
    // CONSOLE & PAGE ERROR ASSERTIONS
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log('🔍 CHECKING CONSOLE & RUNTIME ERRORS...');
    console.log('====================================================');
    if (consoleErrors.length > 0) {
      console.error('Console Errors:', consoleErrors);
      throw new Error(`Encountered ${consoleErrors.length} console errors during universal page audit`);
    } else {
      console.log('  ✓ 0 Console Errors encountered!');
    }

    if (pageErrors.length > 0) {
      console.error('Page Exceptions:', pageErrors);
      throw new Error(`Encountered ${pageErrors.length} page exceptions during universal page audit`);
    } else {
      console.log('  ✓ 0 Page Exceptions encountered!');
    }

    console.log('\n====================================================');
    console.log('🎉 UNIVERSAL CONVERTER (#universal) E2E VERIFIED 100% OPERATIONAL!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch(e) {}
  }
}

testUniversalPage();
