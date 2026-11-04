const fs = require('fs');
const http = require('http');
const assert = require('assert');
const path = require('path');
const vm = require('vm');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const { startServer, handleRequest, MIME_TYPES } = require('./server.js');

console.log('====================================================');
console.log('🧪 RUNNING FULL TECHNICAL AUDIT VERIFICATION SUITE');
console.log('====================================================\n');

async function runAllTests() {
  // --------------------------------------------------------------------------
  // TEST 1: Server Port Collision & HTTP Serving
  // --------------------------------------------------------------------------
  console.log('▶ Test 1: Server Port Collision & HTTP Serving...');
  await new Promise((resolve, reject) => {
    const testPort = 3980;
    const blocker = http.createServer((req, res) => res.end('blocker'));
    blocker.listen(testPort, () => {
      // Start server on occupied port
      startServer(testPort, 5, (activeServer, boundPort) => {
        try {
          assert.strictEqual(boundPort, testPort + 1, `Expected server to bind to ${testPort + 1}, but got ${boundPort}`);
          console.log(`  ✓ EADDRINUSE successfully caught on ${testPort}, relocated to ${boundPort}`);
          
          activeServer.close(() => {
            blocker.close(() => {
              // Test handleRequest directly with mock request and response
              const mockReq = { url: '/', headers: { host: 'localhost' } };
              let statusWritten = 0;
              let headersWritten = {};
              let bodyWritten = '';
              const mockRes = {
                writeHead: (status, headers) => {
                  statusWritten = status;
                  headersWritten = headers;
                },
                end: (content) => {
                  bodyWritten = content ? content.toString() : '';
                  assert.strictEqual(statusWritten, 200, 'handleRequest should return 200 OK');
                  assert.strictEqual(headersWritten['Content-Type'], 'text/html; charset=utf-8');
                  assert.ok(bodyWritten.includes('PDFZen'), 'Index page should contain PDFZen branding');
                  console.log('  ✓ handleRequest dispatch and static file delivery verified.');
                  resolve();
                }
              };
              handleRequest(mockReq, mockRes);
            });
          });
        } catch (err) {
          activeServer.close();
          blocker.close();
          reject(err);
        }
      });
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: DOCX Parsing Regex & Token Handling
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: DOCX Parsing Regex & Token Handling...');
  
  // Extract extractDocxParagraphs from index.html using vm
  const docxFnMatch = htmlContent.match(/function extractDocxParagraphs\(docXml\) \{[\s\S]*?\n    \}/);
  assert.ok(docxFnMatch, 'extractDocxParagraphs must be present in index.html');
  const unescapeMatch = htmlContent.match(/function unescapeXml\(str\) \{[\s\S]*?\n    \}/);
  
  const sandbox = {};
  vm.createContext(sandbox);
  if (unescapeMatch) vm.runInContext(unescapeMatch[0], sandbox);
  vm.runInContext(docxFnMatch[0], sandbox);
  const extractDocxParagraphs = sandbox.extractDocxParagraphs;
  const parseDocx = (xml) => JSON.parse(JSON.stringify(extractDocxParagraphs(xml)));

  // Case 2A: Tags with xml:space="preserve"
  const docXmlAttr = '<w:p><w:r><w:t xml:space="preserve">Hello </w:t><w:t>World</w:t></w:r></w:p>';
  const resAttr = parseDocx(docXmlAttr);
  assert.deepStrictEqual(resAttr, ['Hello World'], 'Should not include xml:space attribute text');

  // Case 2B: Multiple attributes & namespace prefix
  const docXmlMulti = '<w:p w14:paraId="ABC1234"><w:r><w:t xml:space="preserve" xml:lang="en-US">Text with attrs</w:t></w:r></w:p>';
  const resMulti = parseDocx(docXmlMulti);
  assert.deepStrictEqual(resMulti, ['Text with attrs']);

  // Case 2C: Tabs and soft breaks
  const docXmlTabs = '<w:p><w:r><w:t>Col1</w:t><w:tab/><w:t>Col2</w:t><w:br/><w:t>Row2</w:t></w:r></w:p>';
  const resTabs = parseDocx(docXmlTabs);
  assert.deepStrictEqual(resTabs, ['Col1 Col2\nRow2']);

  // Case 2D: XML Entities (&quot;, &apos;, &amp;, &lt;, &gt;)
  const docXmlEntities = '<w:p><w:r><w:t>&lt;Tag&gt; &quot;Quotes&quot; &amp; &apos;Apostrophes&#39;</w:t></w:r></w:p>';
  const resEntities = parseDocx(docXmlEntities);
  assert.deepStrictEqual(resEntities, ['<Tag> "Quotes" & \'Apostrophes\'']);

  // Case 2E: Null, undefined, empty
  assert.deepStrictEqual(parseDocx(''), ['(No readable text found in document)']);
  assert.deepStrictEqual(parseDocx(null), ['(No readable text found in document)']);
  assert.deepStrictEqual(parseDocx(undefined), ['(No readable text found in document)']);
  console.log('  ✓ DOCX regex tokenization, entity decoding, and edge cases verified.');

  // --------------------------------------------------------------------------
  // TEST 3: Genuine OpenXML Word Generation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Genuine OpenXML Word Generation...');
  assert.ok(htmlContent.includes('[Content_Types].xml'), 'Must package OpenXML [Content_Types].xml');
  assert.ok(htmlContent.includes('_rels/.rels'), 'Must package OpenXML _rels/.rels');
  assert.ok(htmlContent.includes('word/document.xml'), 'Must package OpenXML word/document.xml');
  assert.ok(htmlContent.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'Must output standard WordprocessingML MIME');

  // Verify createOpenXmlDocxBlob accepts options.orientation and options.pageSize
  assert.ok(htmlContent.includes('options.orientation === \'landscape\''), 'createOpenXmlDocxBlob must check orientation');
  assert.ok(htmlContent.includes('options.pageSize === \'letter\''), 'createOpenXmlDocxBlob must check pageSize');
  assert.ok(htmlContent.includes('w:orient="landscape"'), 'createOpenXmlDocxBlob must output w:orient="landscape" for landscape');
  console.log('  ✓ OpenXML ZIP architecture and page geometry formatting verified.');

  // --------------------------------------------------------------------------
  // TEST 4: White Background Fill for JPEG Canvas
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: White Background Fill for JPEG Canvas...');
  
  // Check runCompress
  const compressMatch = htmlContent.match(/async function runCompress\(\) \{[\s\S]*?\n    \}/);
  assert.ok(compressMatch, 'runCompress must exist');
  assert.ok(compressMatch[0].includes("ctx.fillStyle = '#ffffff'"), 'runCompress must set fillStyle to white');
  assert.ok(compressMatch[0].includes("ctx.fillRect(0, 0, canvas.width, canvas.height)"), 'runCompress must fillRect');

  // Check runPdfToJpg
  const pdfToJpgMatch = htmlContent.match(/async function runPdfToJpg\(\) \{[\s\S]*?\n    \}/);
  assert.ok(pdfToJpgMatch, 'runPdfToJpg must exist');
  assert.ok(pdfToJpgMatch[0].includes("if (!isPng)"), 'runPdfToJpg must check format');
  assert.ok(pdfToJpgMatch[0].includes("ctx.fillStyle = '#ffffff'"), 'runPdfToJpg must set fillStyle to white for non-PNG');
  console.log('  ✓ White background canvas fill in runCompress and runPdfToJpg verified.');

  // --------------------------------------------------------------------------
  // TEST 5: WebP Image Support in JPG to PDF
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: WebP Image Support in JPG to PDF...');
  const jpgToPdfMatch = htmlContent.match(/async function runJpgToPdf\(\) \{[\s\S]*?\n    \}/);
  assert.ok(jpgToPdfMatch, 'runJpgToPdf must exist');
  assert.ok(jpgToPdfMatch[0].includes('imageBytesToPngBytes'), 'runJpgToPdf must transcode non-JPG/PNG formats');
  assert.ok(jpgToPdfMatch[0].includes('image/webp'), 'runJpgToPdf must explicitly reference webp transcoding');

  // Check accept property
  assert.ok(htmlContent.includes("accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'"), 'JPG to PDF accept must include webp extension');
  // Check drop validation includes webp fallback
  assert.ok(htmlContent.includes('/\\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name)'), 'File drag and drop must validate extensions for empty MIME');
  console.log('  ✓ WebP transcoding and file selection tolerance verified.');

  // --------------------------------------------------------------------------
  // TEST 6: Touch Event Support in Edit Annotator
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 6: Touch Event Support in Edit Annotator...');
  const annotatorMatch = htmlContent.match(/function initAnnotatorListeners\(\) \{[\s\S]*?\n    \}/);
  assert.ok(annotatorMatch, 'initAnnotatorListeners must exist');
  assert.ok(annotatorMatch[0].includes("annotatorCanvas.addEventListener('touchstart'"), 'Must bind touchstart');
  assert.ok(annotatorMatch[0].includes("annotatorCanvas.addEventListener('touchmove'"), 'Must bind touchmove');
  assert.ok(annotatorMatch[0].includes("window.addEventListener('touchend'"), 'Must bind touchend');
  assert.ok(annotatorMatch[0].includes("scaleX = annotatorCanvas.width / rect.width"), 'Must compute scaleX for coordinates');
  assert.ok(annotatorMatch[0].includes("scaleY = annotatorCanvas.height / rect.height"), 'Must compute scaleY for coordinates');
  assert.ok(annotatorMatch[0].includes("passive: false"), 'Touch handlers must specify passive: false to allow preventDefault');
  console.log('  ✓ Touch events and coordinate scaling on annotator canvas verified.');

  // --------------------------------------------------------------------------
  // TEST 7: OCR Clipboard Escaping
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 7: OCR Clipboard Escaping...');
  assert.ok(htmlContent.includes('onclick="copyOcrText()"'), 'OCR download markup must use safe copyOcrText()');
  assert.ok(htmlContent.includes('window.copyOcrText = async function()'), 'copyOcrText helper must be defined');
  assert.ok(htmlContent.includes('navigator.clipboard.writeText(currentOcrText)'), 'copyOcrText must use Clipboard API');
  assert.ok(htmlContent.includes("document.execCommand('copy')"), 'copyOcrText must have execCommand textarea fallback');
  console.log('  ✓ OCR clipboard escaping and fallback mechanism verified.');

  // --------------------------------------------------------------------------
  // TEST 8: Search Modal Keyboard & Backdrop Navigation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 8: Search Modal Keyboard & Backdrop Navigation...');
  assert.ok(htmlContent.includes("e.key === 'Escape'"), 'Keydown must listen for Escape');
  assert.ok(htmlContent.includes("(e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')"), 'Keydown must listen for Ctrl/Cmd+K');
  assert.ok(htmlContent.includes("e.key === '/' && !isInputActive"), 'Keydown must listen for / shortcut when input is inactive');
  assert.ok(htmlContent.includes('onclick="if(event.target === this) closeSearchModal()"'), 'Search modal must have backdrop click handler');
  console.log('  ✓ Search modal Escape, Ctrl+K, /, and backdrop dismissal verified.');

  // --------------------------------------------------------------------------
  // TEST 9: Universal Context Settings Integration
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 9: Universal Context Settings Integration...');
  // Check settings UI renderer
  const settingsMatch = htmlContent.match(/function renderUniversalContextSettings\(sourceFmt, targetFmt\) \{[\s\S]*?\n    \}/);
  assert.ok(settingsMatch, 'renderUniversalContextSettings must exist');
  assert.ok(settingsMatch[0].includes('univ-opt-orientation'), 'Must render univ-opt-orientation');
  assert.ok(settingsMatch[0].includes('univ-opt-pagesize'), 'Must render univ-opt-pagesize');
  assert.ok(settingsMatch[0].includes('univ-opt-theme'), 'Must render univ-opt-theme');
  assert.ok(settingsMatch[0].includes('univ-opt-doc-title'), 'Must render univ-opt-doc-title');
  assert.ok(settingsMatch[0].includes('univ-opt-doc-font'), 'Must render univ-opt-doc-font');

  // Verify 4 target functions read settings
  const dataToPdf = htmlContent.match(/async function runUnivDataToPdf\([\s\S]*?\n    \}/);
  assert.ok(dataToPdf[0].includes("document.getElementById('univ-opt-doc-title')?.value"), 'runUnivDataToPdf must read title');
  assert.ok(dataToPdf[0].includes("document.getElementById('univ-opt-doc-font')?.value"), 'runUnivDataToPdf must read font');
  assert.ok(dataToPdf[0].includes("document.getElementById('univ-opt-orientation')?.value"), 'runUnivDataToPdf must read orientation');
  assert.ok(dataToPdf[0].includes("document.getElementById('univ-opt-pagesize')?.value"), 'runUnivDataToPdf must read pagesize');
  assert.ok(dataToPdf[0].includes("document.getElementById('univ-opt-theme')?.value"), 'runUnivDataToPdf must read theme');

  const textToPdf = htmlContent.match(/async function runUnivTextToPdf\([\s\S]*?\n    \}/);
  assert.ok(textToPdf[0].includes("document.getElementById('univ-opt-doc-title')?.value"), 'runUnivTextToPdf must read title');
  assert.ok(textToPdf[0].includes("document.getElementById('univ-opt-doc-font')?.value"), 'runUnivTextToPdf must read font');

  const pdfToDocx = htmlContent.match(/async function runUnivPdfToDocx\([\s\S]*?\n    \}/);
  assert.ok(pdfToDocx[0].includes("document.getElementById('univ-opt-orientation')?.value"), 'runUnivPdfToDocx must read orientation');
  assert.ok(pdfToDocx[0].includes("document.getElementById('univ-opt-pagesize')?.value"), 'runUnivPdfToDocx must read pagesize');
  assert.ok(pdfToDocx[0].includes("createOpenXmlDocxBlob(bodyXml, { orientation, pageSize })"), 'runUnivPdfToDocx must pass orientation and pageSize');

  const textToDocx = htmlContent.match(/async function runUnivTextToDocx\([\s\S]*?\n    \}/);
  assert.ok(textToDocx[0].includes("document.getElementById('univ-opt-orientation')?.value"), 'runUnivTextToDocx must read orientation');
  assert.ok(textToDocx[0].includes("document.getElementById('univ-opt-pagesize')?.value"), 'runUnivTextToDocx must read pagesize');
  assert.ok(textToDocx[0].includes("createOpenXmlDocxBlob(bodyXml, { orientation, pageSize })"), 'runUnivTextToDocx must pass orientation and pageSize');

  // Verify font application in generateTablePdf & generateTextPdf
  assert.ok(htmlContent.includes("let fontChoice = options.font || 'Helvetica'"), 'generateTablePdf must handle options.font');
  console.log('  ✓ Universal context settings DOM controls, data bindings, and PDF/DOCX application verified.');

  // --------------------------------------------------------------------------
  // TEST 10: Protect & Unlock PDF Tools
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 10: Protect & Unlock PDF Tools...');
  const protectMatch = htmlContent.match(/async function runProtect\(\) \{[\s\S]*?\n    \}/);
  assert.ok(protectMatch, 'runProtect must exist');
  assert.ok(protectMatch[0].includes("if (!pass) throw new Error(\"Password cannot be blank.\")"), 'runProtect must validate password');
  assert.ok(protectMatch[0].includes("if (pass !== confirm) throw new Error(\"Passwords do not match.\")"), 'runProtect must check confirmation');
  assert.ok(protectMatch[0].includes("doc.setProducer('PDFZen Privacy Shield')"), 'runProtect must strip tracking metadata');

  const unlockMatch = htmlContent.match(/async function runUnlock\(\) \{[\s\S]*?\n    \}/);
  assert.ok(unlockMatch, 'runUnlock must exist');
  assert.ok(unlockMatch[0].includes("if (isEncrypted)") && unlockMatch[0].includes("Document is not encrypted"), 'runUnlock must branch when document is not encrypted');
  assert.ok(unlockMatch[0].includes("PDFLib.PDFDocument.load(loadedFiles[0].bytes, { ignoreEncryption: true })"), 'runUnlock must preserve vector quality for unencrypted files');
  assert.ok(unlockMatch[0].includes("pdfjsLib.getDocument({ data: loadedFiles[0].bytes, password: pass })"), 'runUnlock must authenticate with password when encrypted');
  console.log('  ✓ Protection metadata stripping and unlocking vector preservation verified.');

  // --------------------------------------------------------------------------
  // TEST 11: 27 Tools Completeness in TOOLS_DATABASE
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 11: 27 Tools Completeness in TOOLS_DATABASE...');
  const toolsDbMatch = htmlContent.match(/const TOOLS_DATABASE = (\[[\s\S]*?\n\s*\]);/);
  assert.ok(toolsDbMatch, 'TOOLS_DATABASE array must exist in index.html');
  const dbSandbox = {};
  vm.createContext(dbSandbox);
  const toolsDb = vm.runInContext('(' + toolsDbMatch[1] + ')', dbSandbox);
  assert.strictEqual(toolsDb.length, 27, `TOOLS_DATABASE should have exactly 27 tools, found ${toolsDb.length}`);

  const expectedNewToolIds = [
    'pdf-to-powerpoint',
    'pdf-to-excel',
    'compare-pdf',
    'redact-pdf',
    'crop-pdf',
    'grayscale-pdf',
    'metadata-pdf',
    'tts-reader'
  ];
  for (const tid of expectedNewToolIds) {
    const tool = toolsDb.find(t => t.id === tid);
    assert.ok(tool, `Tool '${tid}' must be present in TOOLS_DATABASE`);
    assert.ok(tool.name, `Tool '${tid}' must have a name`);
    assert.ok(tool.desc, `Tool '${tid}' must have a description`);
    assert.ok(tool.category, `Tool '${tid}' must have a category`);
    assert.ok(tool.theme, `Tool '${tid}' must have a theme`);
    assert.ok(tool.icon, `Tool '${tid}' must have an icon`);
    assert.ok(tool.badge, `Tool '${tid}' must have a badge`);
    assert.ok(tool.accept, `Tool '${tid}' must define accepted file types`);
    assert.ok(tool.hasOwnProperty('allowMultiple'), `Tool '${tid}' must define allowMultiple`);
  }
  console.log('  ✓ Exactly 27 tools defined with all required schema attributes.');

  // --------------------------------------------------------------------------
  // TEST 12: Bento Grid Cards Pre-rendered & Count Badges in HTML
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 12: Bento Grid Cards Pre-rendered & Count Badges in HTML...');
  const gridMatch = htmlContent.match(/<div id="tools-grid"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/);
  assert.ok(gridMatch, 'tools-grid must be present in index.html');
  const gridHtml = gridMatch[1];
  for (const tool of toolsDb) {
    assert.ok(
      gridHtml.includes(`data-tool-id="${tool.id}"`),
      `tools-grid must contain pre-rendered bento card for tool '${tool.id}'`
    );
    assert.ok(
      gridHtml.includes(`onclick="router.navigate('${tool.id}')"`),
      `Card for '${tool.id}' must have router.navigate('${tool.id}') onclick`
    );
  }
  // Badges & Marquee count validation
  assert.ok(htmlContent.includes('27 Tools'), 'Header/Nav badge must display "27 Tools"');
  assert.ok(htmlContent.includes('27 POWER TOOLS'), 'Marquee banner must display "27 POWER TOOLS"');
  console.log('  ✓ All 27 bento cards pre-rendered and navigation count badges verified.');

  // --------------------------------------------------------------------------
  // TEST 13: UI Control Renderers & Pipeline Handlers Dispatch
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 13: UI Control Renderers & Pipeline Handlers Dispatch...');
  const buildControlsMatch = htmlContent.match(/async function buildToolControls\(\) \{[\s\S]*?\n    \}/);
  assert.ok(buildControlsMatch, 'buildToolControls function must exist');
  const buildControlsCode = buildControlsMatch[0];

  const executeCurrentToolMatch = htmlContent.match(/async function executeCurrentTool\(\) \{[\s\S]*?\n    \}/);
  assert.ok(executeCurrentToolMatch, 'executeCurrentTool function must exist');
  const executeCurrentToolCode = executeCurrentToolMatch[0];

  const toolPipelineMap = {
    'pdf-to-powerpoint': { renderer: 'renderPdfToPptxControls', runner: 'runPdfToPptx' },
    'pdf-to-excel': { renderer: 'renderPdfToExcelControls', runner: 'runPdfToExcel' },
    'compare-pdf': { renderer: 'renderComparePdfControls', runner: 'runComparePdf' },
    'redact-pdf': { renderer: 'renderRedactControls', runner: 'runRedact' },
    'crop-pdf': { renderer: 'renderCropControls', runner: 'runCrop' },
    'grayscale-pdf': { renderer: 'renderGrayscaleControls', runner: 'runGrayscale' },
    'metadata-pdf': { renderer: 'renderMetadataControls', runner: 'runMetadata' },
    'tts-reader': { renderer: 'renderTtsControls', runner: 'runTts' }
  };

  for (const [toolId, funcs] of Object.entries(toolPipelineMap)) {
    assert.ok(
      buildControlsCode.includes(`case '${toolId}':`),
      `buildToolControls must handle case '${toolId}'`
    );
    assert.ok(
      buildControlsCode.includes(funcs.renderer),
      `buildToolControls must invoke ${funcs.renderer} for '${toolId}'`
    );
    assert.ok(
      htmlContent.includes(`function ${funcs.renderer}`),
      `Renderer ${funcs.renderer} must be implemented in index.html`
    );

    assert.ok(
      executeCurrentToolCode.includes(`case '${toolId}':`),
      `executeCurrentTool must handle case '${toolId}'`
    );
    assert.ok(
      executeCurrentToolCode.includes(funcs.runner),
      `executeCurrentTool must invoke ${funcs.runner} for '${toolId}'`
    );
    assert.ok(
      htmlContent.includes(`async function ${funcs.runner}`),
      `Runner ${funcs.runner} must be implemented in index.html`
    );
  }
  console.log('  ✓ Control renderers and execution dispatch pipelines verified for all 8 new tools.');

  // --------------------------------------------------------------------------
  // TEST 14: Genuine OpenXML PPTX & XLSX Package Generation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 14: Genuine OpenXML PPTX & XLSX Package Generation...');
  assert.ok(htmlContent.includes('function colToLetter('), 'colToLetter helper must exist');
  assert.ok(htmlContent.includes('async function createOpenXmlPptxBlob('), 'createOpenXmlPptxBlob must exist');
  assert.ok(htmlContent.includes('async function createOpenXmlXlsxBlob('), 'createOpenXmlXlsxBlob must exist');

  // Verify colToLetter logic via vm
  const colFnMatch = htmlContent.match(/function colToLetter\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(colFnMatch, 'colToLetter implementation must be present');
  const colSandbox = {};
  vm.createContext(colSandbox);
  vm.runInContext(colFnMatch[0], colSandbox);
  assert.strictEqual(colSandbox.colToLetter(1), 'A');
  assert.strictEqual(colSandbox.colToLetter(26), 'Z');
  assert.strictEqual(colSandbox.colToLetter(27), 'AA');
  assert.strictEqual(colSandbox.colToLetter(28), 'AB');
  assert.strictEqual(colSandbox.colToLetter(702), 'ZZ');
  assert.strictEqual(colSandbox.colToLetter(703), 'AAA');

  // PPTX structure check
  assert.ok(htmlContent.includes('ppt/presentation.xml'), 'PPTX generator must package ppt/presentation.xml');
  assert.ok(htmlContent.includes('ppt/slides/slide'), 'PPTX generator must package slide XML');
  assert.ok(htmlContent.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'PPTX generator must set presentationml MIME');

  // XLSX structure check
  assert.ok(htmlContent.includes('xl/workbook.xml'), 'XLSX generator must package xl/workbook.xml');
  assert.ok(htmlContent.includes('xl/worksheets/sheet1.xml'), 'XLSX generator must package xl/worksheets/sheet1.xml');
  assert.ok(htmlContent.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'XLSX generator must set spreadsheetml MIME');
  console.log('  ✓ colToLetter algorithm and OpenXML PPTX/XLSX structures verified.');

  // --------------------------------------------------------------------------
  // TEST 15: Permanent Burn Redaction, Grayscale Luminance, and Vector Crop
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 15: Permanent Burn Redaction, Grayscale Luminance, and Vector Crop...');
  
  // Redaction: verifies permanent burn-in on canvas
  const redactFnMatch = htmlContent.match(/async function runRedact\(\) \{[\s\S]*?\n    \}/);
  assert.ok(redactFnMatch, 'runRedact must exist');
  assert.ok(redactFnMatch[0].includes("ctx.fillStyle = '#000000'"), 'runRedact must fill black rectangle to permanently destroy text/pixels');
  assert.ok(redactFnMatch[0].includes("ctx.fillRect"), 'runRedact must call fillRect for burn-in redaction');

  // Grayscale: verifies standard ITU-R luminance coefficients
  const grayscaleFnMatch = htmlContent.match(/async function runGrayscale\(\) \{[\s\S]*?\n    \}/);
  assert.ok(grayscaleFnMatch, 'runGrayscale must exist');
  assert.ok(grayscaleFnMatch[0].includes('0.299') && grayscaleFnMatch[0].includes('0.587') && grayscaleFnMatch[0].includes('0.114'), 'runGrayscale must compute luminance with 0.299R + 0.587G + 0.114B');

  // Crop: verifies native vector crop box manipulation without rasterization
  const cropFnMatch = htmlContent.match(/async function runCrop\(\) \{[\s\S]*?\n    \}/);
  assert.ok(cropFnMatch, 'runCrop must exist');
  assert.ok(cropFnMatch[0].includes('page.setCropBox') && cropFnMatch[0].includes('page.setMediaBox'), 'runCrop must modify CropBox and MediaBox natively for lossless vector cropping');
  console.log('  ✓ Permanent burn redaction, ITU-R grayscale luminance, and native lossless vector cropping verified.');

  // --------------------------------------------------------------------------
  // TEST 16: OmniConvert Multi-Format Matrix Expansion
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 16: OmniConvert Multi-Format Matrix Expansion...');
  const detectMatch = htmlContent.match(/function detectFileFormat\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(detectMatch, 'detectFileFormat must exist');
  assert.ok(detectMatch[0].includes("'pptx'"), 'detectFileFormat must identify PPTX');
  assert.ok(detectMatch[0].includes("'xlsx'"), 'detectFileFormat must identify XLSX');

  const targetsMatch = htmlContent.match(/function getUniversalTargets\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(targetsMatch, 'getUniversalTargets must exist');
  assert.ok(targetsMatch[0].includes("src === 'pptx'"), 'getUniversalTargets must handle PPTX source');
  assert.ok(targetsMatch[0].includes("src === 'xlsx'"), 'getUniversalTargets must handle XLSX source');
  assert.ok(targetsMatch[0].includes("id: 'pptx'"), 'getUniversalTargets must provide pptx as target');
  assert.ok(targetsMatch[0].includes("id: 'xlsx'"), 'getUniversalTargets must provide xlsx as target');

  // OmniConvert PPTX and XLSX pipeline functions
  const omniPipelines = [
    'runUnivPdfToPptx',
    'runUnivPdfToXlsx',
    'runUnivPptxToPdf',
    'runUnivPptxToTxt',
    'runUnivPptxToHtml',
    'runUnivXlsxToPdf',
    'runUnivXlsxToCsv',
    'runUnivXlsxToJson',
    'runUnivXlsxToDocx',
    'runUnivDataToXlsx',
    'runUnivDocxToPptx'
  ];
  for (const fn of omniPipelines) {
    assert.ok(htmlContent.includes(`async function ${fn}`), `OmniConvert pipeline ${fn} must be defined`);
  }
  console.log('  ✓ OmniConvert multi-format matrix and all conversion pipelines verified.');

  // --------------------------------------------------------------------------
  // TEST 17: Full node:vm Syntax & Compilation Validation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 17: Full node:vm Syntax & Compilation Validation...');
  // Find all inline scripts in index.html
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let sMatch;
  let scriptCount = 0;
  while ((sMatch = scriptRegex.exec(htmlContent)) !== null) {
    const code = sMatch[1].trim();
    if (code.length > 50) {
      scriptCount++;
      try {
        new vm.Script(code, { filename: `inline-script-${scriptCount}.js` });
      } catch (err) {
        assert.fail(`Syntax or compilation error in inline script ${scriptCount}: ${err.message}`);
      }
    }
  }
  assert.ok(scriptCount >= 1, 'At least one inline script must be compiled and validated');
  console.log(`  ✓ ${scriptCount} inline scripts compiled cleanly with zero syntax/parse errors.`);

  // --------------------------------------------------------------------------
  // TEST 18: XML Sanitization, Sparse Matrix Decoding, & Extended Audit
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 18: XML Sanitization, Sparse Matrix Decoding, & Extended Audit...');

  // 18A: escapeXml illegal control characters stripping & helpers
  const escapeXmlFnMatch = htmlContent.match(/function escapeXml\(str\) \{[\s\S]*?\n    \}/);
  assert.ok(escapeXmlFnMatch, 'escapeXml function must exist');
  const unescapeXmlFnMatch = htmlContent.match(/function unescapeXml\(str\) \{[\s\S]*?\n    \}/);
  assert.ok(unescapeXmlFnMatch, 'unescapeXml function must exist');
  const letterToColMatch = htmlContent.match(/function letterToCol\(letters\) \{[\s\S]*?\n    \}/);
  assert.ok(letterToColMatch, 'letterToCol function must exist');

  const xmlSandbox = {};
  vm.createContext(xmlSandbox);
  vm.runInContext(`${escapeXmlFnMatch[0]}\n${unescapeXmlFnMatch[0]}\n${letterToColMatch[0]}`, xmlSandbox);
  const { escapeXml, unescapeXml, letterToCol } = xmlSandbox;

  // Verify escapeXml strips illegal control characters (ASCII 0x00 - 0x1F except tab/newline/cr)
  const dirtyText = "Test\x00\x08Title\x0B\x0C\x0E\x1F & <cool> \"quotes\" 'apostrophe'";
  const escaped = escapeXml(dirtyText);
  assert.strictEqual(escaped, 'TestTitle &amp; &lt;cool&gt; &quot;quotes&quot; &apos;apostrophe&apos;', 'escapeXml must strip XML 1.0 illegal control characters and escape XML entities');

  // Verify unescapeXml
  const unescaped = unescapeXml('&lt;tag&gt; &quot;hello&quot; &amp; &apos;world&#39;');
  assert.strictEqual(unescaped, '<tag> "hello" & \'world\'');

  // Verify letterToCol
  assert.strictEqual(letterToCol('A'), 0);
  assert.strictEqual(letterToCol('B'), 1);
  assert.strictEqual(letterToCol('Z'), 25);
  assert.strictEqual(letterToCol('AA'), 26);
  assert.strictEqual(letterToCol('AZ'), 51);
  assert.strictEqual(letterToCol('BA'), 52);

  // 18B: Metadata keywords safe handling
  const metadataFnMatch = htmlContent.match(/async function renderMetadataControls\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(metadataFnMatch, 'renderMetadataControls must exist');
  assert.ok(metadataFnMatch[0].includes('Array.isArray(rawKw)'), 'renderMetadataControls must safely handle string or array keywords from pdf-lib without throwing TypeError');

  // 18C: Redact canvas touch events and scaling
  const redactPageMatch = htmlContent.match(/async function renderRedactPageView\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(redactPageMatch, 'renderRedactPageView must exist');
  assert.ok(redactPageMatch[0].includes("'touchstart'") && redactPageMatch[0].includes("'touchend'"), 'renderRedactPageView must support touch events for mobile/tablet drawing');
  assert.ok(redactPageMatch[0].includes('e.preventDefault()'), 'renderRedactPageView must prevent scroll during touch redaction');

  // 18D: Compare PDF modes & scopes
  const compareFnMatch = htmlContent.match(/async function runComparePdf\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(compareFnMatch, 'runComparePdf must exist');
  assert.ok(compareFnMatch[0].includes("document.getElementById('compare-mode')?.value"), 'runComparePdf must read compare-mode');
  assert.ok(compareFnMatch[0].includes("document.getElementById('compare-scope')?.value"), 'runComparePdf must read compare-scope');
  assert.ok(compareFnMatch[0].includes("'side-by-side'") && compareFnMatch[0].includes("'overlay'") && compareFnMatch[0].includes("'text'"), 'runComparePdf must implement side-by-side, overlay, and text diff modes');

  // 18E: PPTX slide themes & multi-paragraph layout
  const pptxBlobMatch = htmlContent.match(/async function createOpenXmlPptxBlob\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(pptxBlobMatch, 'createOpenXmlPptxBlob must exist with theme support');
  assert.ok(pptxBlobMatch[0].includes("theme === 'dark'") && pptxBlobMatch[0].includes("theme === 'boxy'"), 'createOpenXmlPptxBlob must support dark and boxy themes');
  assert.ok(pptxBlobMatch[0].includes('<a:p>'), 'createOpenXmlPptxBlob must format slides with proper multi-paragraph XML');

  // 18F: Crop box non-zero origin handling
  const cropBoxMatch = htmlContent.match(/async function runCrop\([^)]*\) \{[\s\S]*?\n    \}/);
  assert.ok(cropBoxMatch, 'runCrop must exist');
  assert.ok(cropBoxMatch[0].includes('box.x') && cropBoxMatch[0].includes('box.y'), 'runCrop must respect non-zero CropBox/MediaBox origin coordinates');

  // 18G: TTS Reader speech cancellation on route navigation and reset
  const routerMatch = htmlContent.match(/navigate\([^)]*\)\s*\{[\s\S]*?\n      \}/);
  assert.ok(routerMatch, 'router.navigate must exist');
  assert.ok(routerMatch[0].includes('speechSynthesis.cancel()'), 'router.navigate must cancel TTS speech to prevent runaway audio across routes');

  const resetMatch = htmlContent.match(/function resetWorkspace\(\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(resetMatch, 'resetWorkspace must exist');
  assert.ok(resetMatch[0].includes('speechSynthesis.cancel()'), 'resetWorkspace must cancel TTS speech when clearing files');

  console.log('  ✓ XML sanitization, sparse matrix indexing, touch events, metadata safety, compare modes, and audio lifecycle verified.');

  // --------------------------------------------------------------------------
  // TEST 19: Mobile, Tablet & Touch Ergonomics
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 19: Mobile, Tablet & Touch Ergonomics...');

  // 19A: Viewport Meta & Safe Area Inset Support
  assert.ok(htmlContent.includes('viewport-fit=cover'), 'Viewport meta must include viewport-fit=cover for notch devices');
  assert.ok(htmlContent.includes('--safe-top: env(safe-area-inset-top') && htmlContent.includes('--safe-bottom: env(safe-area-inset-bottom'), 'CSS root must define --safe-top and --safe-bottom CSS variables');
  assert.ok(htmlContent.includes('padding-bottom: calc(76px + var(--safe-bottom))'), 'Mobile body padding must accommodate bottom dock and safe-area inset');
  assert.ok(htmlContent.includes('touch-action: manipulation;'), 'Touch-action manipulation must be applied to interactive controls');

  // 19B: Mobile Bottom Navigation Dock (< 768px Viewports)
  assert.ok(htmlContent.includes('id="mobile-bottom-dock"'), 'Mobile bottom app dock must exist in DOM');
  assert.ok(htmlContent.includes('dock-btn-home') && htmlContent.includes('dock-btn-universal') && htmlContent.includes('dock-btn-tools'), 'Mobile dock must contain home, universal, and tools navigation buttons');
  assert.ok(htmlContent.includes('dock-theme-icon'), 'Mobile dock must contain theme switcher icon');
  assert.ok(htmlContent.includes('updateDockActive('), 'updateDockActive function must be defined and invoked on route transitions');

  // 19C: Theme Synchronization Between Desktop and Mobile Dock
  const toggleThemeFnMatch = htmlContent.match(/function toggleTheme\(\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(toggleThemeFnMatch, 'toggleTheme function must exist');
  assert.ok(toggleThemeFnMatch[0].includes('dock-theme-icon') || htmlContent.includes("document.getElementById('dock-theme-icon')"), 'Theme toggle must synchronize both desktop and mobile dock theme icons');

  // 19D: Horizontal Momentum Scrolling and Category Pills
  assert.ok(htmlContent.includes('.scroll-touch'), 'CSS must define .scroll-touch momentum scrolling rules');
  assert.ok(htmlContent.includes('-webkit-overflow-scrolling: touch'), 'Momentum touch scrolling must be enabled for iOS Safari');
  assert.ok(htmlContent.includes('whitespace-nowrap shrink-0'), 'Category filter pills must have whitespace-nowrap and shrink-0 to prevent multiline breakage');

  // 19E: Canvas Dynamic Scaling & Touch Event Ergonomics
  const sigPadFnMatch = htmlContent.match(/function initSignaturePad\(\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(sigPadFnMatch, 'initSignaturePad must exist');
  assert.ok(sigPadFnMatch[0].includes('containerWidth'), 'initSignaturePad must calculate canvas width dynamically from container width');
  assert.ok(sigPadFnMatch[0].includes('scaleX') && sigPadFnMatch[0].includes('scaleY'), 'initSignaturePad must calibrate touch coordinates using scaleX and scaleY');

  const editAnnotFnMatch = htmlContent.match(/async function renderEditAnnotatorControls\([^)]*\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(editAnnotFnMatch, 'renderEditAnnotatorControls must exist');
  assert.ok(editAnnotFnMatch[0].includes('responsiveScale') || editAnnotFnMatch[0].includes('containerWidth'), 'renderEditAnnotatorControls must compute responsive viewport scale based on container width');

  const redactControlsFnMatch = htmlContent.match(/async function renderRedactControls\([^)]*\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(redactControlsFnMatch, 'renderRedactControls must exist');
  assert.ok(redactControlsFnMatch[0].includes('touch-none') || redactControlsFnMatch[0].includes('touch-action: none'), 'Redaction canvas must prevent page scroll with touch-action: none');

  // 19F: Toast Mobile Media Positioning
  assert.ok(htmlContent.includes('#toast-container') && htmlContent.includes('bottom: calc(76px + var(--safe-bottom) + 12px)'), 'Toast notifications must be repositioned above the bottom dock on mobile devices');

  console.log('  ✓ Viewport safe-areas, mobile bottom dock, touch manipulation, category pills, responsive canvases, and mobile toast positioning verified.');

  // --------------------------------------------------------------------------
  // TEST 20: Unlimited File Capacity & Multi-GB Memory Scaling
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 20: Unlimited File Capacity & Multi-GB Memory Scaling...');

  // 20A: Assert index.html does not contain legacy 200MB or 200 MB cap text in upload zones
  assert.ok(!htmlContent.includes('200MB') && !htmlContent.includes('200 MB'), 'index.html must not contain legacy 200MB or 200 MB limit text');
  assert.ok(htmlContent.includes('⚡ 100% Unlimited File Size • In-Memory Processing • Zero Server Caps'), 'Upload zone must display 100% Unlimited File Size message');

  // 20B: Assert formatBytes cleanly formats MB, GB, TB, and PB without errors or undefined
  const formatBytesMatch = htmlContent.match(/function formatBytes\(bytes,\s*decimals\s*=\s*1\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(formatBytesMatch, 'formatBytes function must exist');
  const fbSandbox = {};
  vm.createContext(fbSandbox);
  vm.runInContext(formatBytesMatch[0], fbSandbox);
  const fb = fbSandbox.formatBytes;

  assert.strictEqual(fb(0), '0 B');
  assert.strictEqual(fb(1024), '1 KB');
  assert.strictEqual(fb(1024 * 1024), '1 MB');
  assert.strictEqual(fb(500 * 1024 * 1024), '500 MB');
  assert.strictEqual(fb(1.5 * 1024 * 1024 * 1024), '1.5 GB');
  assert.strictEqual(fb(2.5 * 1024 * 1024 * 1024), '2.5 GB');
  assert.strictEqual(fb(1024 * 1024 * 1024 * 1024), '1 TB');
  assert.strictEqual(fb(5 * 1024 * 1024 * 1024 * 1024), '5 TB');
  assert.strictEqual(fb(1024 * 1024 * 1024 * 1024 * 1024), '1 PB');
  assert.strictEqual(fb(100 * 1024 * 1024 * 1024 * 1024 * 1024), '100 PB', 'formatBytes must clamp to PB without undefined for massive sizes');

  // 20C: Assert 5GB limit for sensitive tools and unlimited for general tools
  assert.ok(htmlContent.includes('MAX_SENSITIVE_BYTES = 5 * 1024 * 1024 * 1024'), 'handleSelectedFiles must define 5 GB limit for sensitive tools');
  assert.ok(htmlContent.includes('isSensitiveTool'), 'handleSelectedFiles must conditionally enforce 5 GB cap only on sensitive tools');
  assert.ok(htmlContent.includes('f.size > 150 * 1024 * 1024'), 'handleSelectedFiles must include large file RAM processing indicator');
  assert.ok(htmlContent.includes('upload-limit-notice'), 'setupToolWorkspace must update upload limit notice dynamically');

  // 20D: Assert buffer cleanup in resetWorkspace and resetUniversalWorkspace
  const resetFnMatch = htmlContent.match(/function resetWorkspace\(\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(resetFnMatch, 'resetWorkspace must exist');
  assert.ok(resetFnMatch[0].includes('loadedFiles = []'), 'resetWorkspace must deallocate loadedFiles array');
  assert.ok(resetFnMatch[0].includes('item.bytes = null') || resetFnMatch[0].includes('bytes = null'), 'resetWorkspace must nullify buffers/bytes to aid GC');

  const resetUnivFnMatch = htmlContent.match(/function resetUniversalWorkspace\(\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(resetUnivFnMatch, 'resetUniversalWorkspace must exist');
  assert.ok(resetUnivFnMatch[0].includes('bytes: null') || resetUnivFnMatch[0].includes('bytes = null'), 'resetUniversalWorkspace must nullify buffer bytes');

  // 20E: Dedicated FAQ item exists
  assert.ok(htmlContent.includes('Is there any file size limit?'), 'FAQ must include question on file size limits');
  assert.ok(htmlContent.includes('5 GB memory protection limit'), 'FAQ must explain 5 GB limit for sensitive security tools');

  console.log('  ✓ Unlimited capacity copy, 5 GB sensitive tools cap, formatBytes TB/PB scaling, buffer deallocation, and FAQ verified.');

  // --------------------------------------------------------------------------
  // TEST 21: Unicode-to-WinAnsi Transliteration & Sanitization Guard
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 21: Unicode-to-WinAnsi Transliteration & Sanitization Guard...');

  const sanitizeWinAnsiFnMatch = htmlContent.match(/function sanitizeWinAnsi\(str,\s*preserveNewlines\s*=\s*true\)\s*\{[\s\S]*?\n    \}/);
  assert.ok(sanitizeWinAnsiFnMatch, 'sanitizeWinAnsi function must exist in index.html');

  const winAnsiSetMatch = htmlContent.match(/const WIN_ANSI_SET = new Uint8Array\(65536\);[\s\S]*?const UNICODE_TO_WINANSI_MAP = \{[\s\S]*?\};\n/);
  assert.ok(winAnsiSetMatch, 'WIN_ANSI_SET and UNICODE_TO_WINANSI_MAP must exist in index.html');

  const winAnsiSandbox = {};
  vm.createContext(winAnsiSandbox);
  vm.runInContext(`${winAnsiSetMatch[0]}\n${sanitizeWinAnsiFnMatch[0]}`, winAnsiSandbox);
  const sanitizeWinAnsi = winAnsiSandbox.sanitizeWinAnsi;
  const WIN_ANSI_SET = vm.runInContext('WIN_ANSI_SET', winAnsiSandbox);

  // 21A: Right and left arrows (e.g. WinAnsi cannot encode "→" 0x2192)
  const arrowTest = 'Conversion failed: WinAnsi cannot encode "→" (0x2192) Step 1 → Step 2 ← Back ⇒ Next';
  const cleanArrows = sanitizeWinAnsi(arrowTest);
  assert.strictEqual(cleanArrows, 'Conversion failed: WinAnsi cannot encode "->" (0x2192) Step 1 -> Step 2 <- Back => Next');

  // 21B: Typographic quotes, bullets, and dashes
  const typographyTest = '“Smart quotes” & ‘apostrophes’ • Bullet item — Em dash – En dash';
  const cleanTypography = sanitizeWinAnsi(typographyTest);
  assert.strictEqual(cleanTypography, '"Smart quotes" & \'apostrophes\' * Bullet item -- Em dash - En dash');

  // 21C: Math, logic, tabs, and currencies
  const mathTest = 'Math: x ≤ 10, y ≥ 5, z ≠ 0, approx ≈ 3.14, ±1, 10 × 2 ÷ 5 = 4, inf ∞; Cost: ₹1500\tTabs';
  const cleanMath = sanitizeWinAnsi(mathTest);
  assert.strictEqual(cleanMath, 'Math: x <= 10, y >= 5, z != 0, approx ~= 3.14, +/-1, 10 * 2 / 5 = 4, inf inf; Cost: Rs.1500    Tabs');

  // 21D: Emojis and diacritics
  const emojiTest = 'Launch: 🚀 Feature release ⚠️ Warning ⭐ Star; Accents: Héllo wörld čťž';
  const cleanEmoji = sanitizeWinAnsi(emojiTest);
  assert.strictEqual(cleanEmoji, 'Launch:  Feature release [!] Warning * Star; Accents: Hello world ctz');

  // 21E: Null, undefined, empty, number handling
  assert.strictEqual(sanitizeWinAnsi(''), '');
  assert.strictEqual(sanitizeWinAnsi(null), '');
  assert.strictEqual(sanitizeWinAnsi(undefined), '');
  assert.strictEqual(sanitizeWinAnsi(12345), '12345');

  // 21F: Multi-line preservation
  const multiline = "Line 1\r\nLine 2\nLine 3";
  assert.strictEqual(sanitizeWinAnsi(multiline, true), "Line 1\nLine 2\nLine 3");
  assert.strictEqual(sanitizeWinAnsi(multiline, false), "Line 1 Line 2 Line 3");

  // 21G: Universal encodability assertion: every output character MUST be \n or in WIN_ANSI_SET
  for (const str of [cleanArrows, cleanTypography, cleanMath, cleanEmoji]) {
    for (const ch of str) {
      if (ch === '\n') continue;
      assert.ok(WIN_ANSI_SET[ch.charCodeAt(0)], `Character "${ch}" (code ${ch.charCodeAt(0)}) must be valid in WIN_ANSI_SET`);
    }
  }

  // 21H: Assert integration across all document conversion pipelines in index.html
  assert.ok(htmlContent.includes('generateTextPdf'), 'generateTextPdf must exist');
  assert.ok(htmlContent.includes('generateTablePdf'), 'generateTablePdf must exist');
  assert.ok(htmlContent.includes('sanitizeWinAnsi(options.title'), 'options.title must be sanitized in PDF engines');
  assert.ok(htmlContent.includes('installPdfLibWinAnsiProtection'), 'installPdfLibWinAnsiProtection must exist');

  console.log('  ✓ WinAnsi arrow transliteration, quotes, bullets, dashes, math, emoji safety, and pipeline bindings verified.');

  console.log('\n====================================================');
  console.log('🎉 ALL 21 TECHNICAL AUDIT VERIFICATION TESTS PASSED!');
  console.log('====================================================');
}

runAllTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
