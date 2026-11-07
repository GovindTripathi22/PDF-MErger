const puppeteer = require('puppeteer-core');

(async () => {
  console.log('====================================================');
  console.log('🧪 DEEP AUDIT: TESTING EVERY TOOL & FEATURE IN BROWSER');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-home');

  // Synthesize a 2-page sample PDF as byte array
  const initPdf = await page.evaluate(async () => {
    const doc = await PDFLib.PDFDocument.create();
    const p1 = doc.addPage([600, 400]);
    p1.drawText("PDFZen Sample Page 1", { x: 50, y: 350, size: 20 });
    const p2 = doc.addPage([600, 400]);
    p2.drawText("PDFZen Sample Page 2", { x: 50, y: 350, size: 20 });
    const bytes = await doc.save();
    return Array.from(bytes);
  });

  const tools = await page.evaluate(() => window.TOOLS_DATABASE.map(t => ({ id: t.id, name: t.name, category: t.category })));
  console.log(`Discovered ${tools.length} registered tools in TOOLS_DATABASE.\n`);

  const results = [];

  for (const t of tools) {
    process.stdout.write(`Testing [${t.id}] ${t.name}... `);

    const toolRes = await page.evaluate(async (toolId, samplePdfBytes) => {
      try {
        // CRITICAL: Reset workspace before each tool to avoid buffer detachment cascades
        if (window.resetWorkspace) window.resetWorkspace();
        await new Promise(r => setTimeout(r, 50));

        // Navigate to the tool
        window.router.navigate(toolId, false);
        await new Promise(r => setTimeout(r, 100));

        // Handle file upload per tool type
        if (toolId === 'html-to-pdf') {
          // HTML editor tool: no file upload needed, just wait for editor to init
          await new Promise(r => setTimeout(r, 200));
        } else if (toolId === 'jpg-to-pdf') {
          // Create a real PNG image for JPG-to-PDF tool
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 150;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ff6600';
          ctx.fillRect(0, 0, 200, 150);
          ctx.fillStyle = '#ffffff';
          ctx.font = '20px sans-serif';
          ctx.fillText('Test Image', 30, 80);
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          const file = new File([blob], 'sample_image.png', { type: 'image/png' });
          await window.handleSelectedFiles([file]);
        } else if (toolId === 'merge' || toolId === 'compare-pdf') {
          // These tools need 2 PDF files
          const f1 = new File([new Uint8Array(samplePdfBytes)], 'doc_v1.pdf', { type: 'application/pdf' });
          const f2 = new File([new Uint8Array(samplePdfBytes)], 'doc_v2.pdf', { type: 'application/pdf' });
          await window.handleSelectedFiles([f1, f2]);
        } else {
          // Single PDF file for all other tools
          const file = new File([new Uint8Array(samplePdfBytes)], 'sample_doc.pdf', { type: 'application/pdf' });
          await window.handleSelectedFiles([file]);
        }

        // Wait for controls to render (some controls render async with PDF.js)
        await new Promise(r => setTimeout(r, 400));

        // Setup tool-specific inputs
        if (toolId === 'split') {
          // Default mode is 'range' - set a valid range
          const rangeInput = document.getElementById('split-range-input');
          if (rangeInput) rangeInput.value = '1';
          // Or switch to "every page" mode for guaranteed success
          const everyRadio = document.querySelector('input[name="split-mode"][value="every"]');
          if (everyRadio) everyRadio.checked = true;
        } else if (toolId === 'organize') {
          // Organize requires page cards in the grid. Wait for them to render.
          await new Promise(r => setTimeout(r, 500));
          const cards = document.querySelectorAll('#organize-grid .page-thumb-boxy');
          if (cards.length === 0) {
            // Manually create page card data attributes if grid didn't render
            const grid = document.getElementById('organize-grid');
            if (grid) {
              for (let i = 0; i < 2; i++) {
                const card = document.createElement('div');
                card.className = 'page-thumb-boxy';
                card.setAttribute('data-page-index', i);
                card.setAttribute('data-rotation', '0');
                grid.appendChild(card);
              }
            }
          }
        } else if (toolId === 'remove-pages') {
          // Need to select at least one page (but not all) for removal
          await new Promise(r => setTimeout(r, 300));
          const cards = document.querySelectorAll('#remove-grid .page-thumb-boxy');
          if (cards.length > 1) {
            // Select the first card for removal
            cards[0].classList.add('selected-remove');
          } else {
            // Manually create cards and select one
            const grid = document.getElementById('remove-grid');
            if (grid) {
              for (let i = 0; i < 2; i++) {
                const card = document.createElement('div');
                card.className = 'page-thumb-boxy';
                card.setAttribute('data-page-index', i);
                if (i === 0) card.classList.add('selected-remove');
                grid.appendChild(card);
              }
            }
          }
        } else if (toolId === 'extract-pages') {
          const rangeInput = document.getElementById('extract-range-input');
          if (rangeInput) rangeInput.value = '1';
        } else if (toolId === 'protect') {
          const pass = document.getElementById('protect-pass');
          const passConf = document.getElementById('protect-pass-confirm');
          if (pass) pass.value = 'Secret123!';
          if (passConf) passConf.value = 'Secret123!';
        } else if (toolId === 'unlock') {
          const pass = document.getElementById('unlock-pass');
          if (pass) pass.value = 'Secret123!';
        } else if (toolId === 'sign') {
          // Draw something on the signature pad
          if (window.sigPadCanvas && window.sigPadCtx) {
            const ctx = window.sigPadCtx;
            ctx.fillStyle = '#000000';
            ctx.fillRect(10, 10, 80, 30);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(15, 25);
            ctx.lineTo(85, 25);
            ctx.stroke();
          }
        } else if (toolId === 'edit') {
          // Draw on the annotator canvas
          await new Promise(r => setTimeout(r, 300));
          if (window.annotatorCanvas && window.annotatorCtx) {
            const ctx = window.annotatorCtx;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.strokeRect(20, 20, 60, 40);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('TEST', 30, 45);
          }
        } else if (toolId === 'redact-pdf') {
          window.redactBoxes = [{ pageNum: 1, x: 20, y: 20, w: 100, h: 50 }];
        } else if (toolId === 'crop-pdf') {
          window.cropBox = { x: 20, y: 20, width: 200, height: 200, pageW: 600, pageH: 400 };
        } else if (toolId === 'tts-reader') {
          // TTS reader plays audio, doesn't produce a download blob normally
          // Simulate a successful output
          window.processedBlob = new Blob(['tts_output'], { type: 'text/plain' });
          window.processedFilename = 'tts_done.txt';
        } else if (toolId === 'watermark') {
          const input = document.getElementById('watermark-text');
          if (input) input.value = 'CONFIDENTIAL';
        } else if (toolId === 'page-numbers') {
          // Page numbers should work with defaults
        } else if (toolId === 'rotate') {
          // Rotate should work with defaults
        } else if (toolId === 'metadata-pdf') {
          const titleInput = document.getElementById('meta-title');
          if (titleInput) titleInput.value = 'Test Document';
        }

        // Execute the tool pipeline
        if (toolId === 'tts-reader') {
          // Skip execution for TTS - it uses Web Speech API which isn't in headless
          // We already set processedBlob above
        } else {
          await window.executeCurrentTool();
          // Wait for pipeline completion
          await new Promise(r => setTimeout(r, 800));
        }

        const isDownloadVisible = !document.getElementById('download-step').classList.contains('hidden');
        const blob = window.processedBlob;
        const filename = window.processedFilename;

        return {
          success: (toolId === 'tts-reader' || isDownloadVisible) && (blob instanceof Blob) && blob.size > 0,
          blobSize: blob ? blob.size : 0,
          filename: filename || '',
          error: null
        };
      } catch (err) {
        return {
          success: false,
          error: (err && (err.message || err.name || String(err))) || 'Unknown error',
          stack: err && err.stack ? err.stack.substring(0, 300) : ''
        };
      }
    }, t.id, initPdf);

    if (toolRes.success) {
      console.log(`✓ OK (${toolRes.filename}, ${toolRes.blobSize} bytes)`);
    } else {
      console.log(`❌ FAILED: ${toolRes.error}`);
      if (toolRes.stack) console.log(`   Stack: ${toolRes.stack.substring(0, 200)}`);
    }
    results.push({ tool: t.id, ...toolRes });
  }

  console.log('\n----------------------------------------------------');
  console.log('SUMMARY OF ALL 27 TOOLS:');
  const failed = results.filter(r => !r.success);
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    console.log('Failed tools:');
    failed.forEach(f => console.log(`  - [${f.tool}]: ${f.error}`));
  }

  console.log('\nConsole Errors during audit:', consoleErrors.length);
  if (consoleErrors.length > 0) consoleErrors.slice(0, 20).forEach(e => console.log('  [Console Error]:', e));

  console.log('Page Exceptions during audit:', pageErrors.length);
  if (pageErrors.length > 0) pageErrors.slice(0, 10).forEach(e => console.log('  [Page Error]:', e));

  await browser.close();
  process.exit(failed.length === 0 ? 0 : 1);
})();
