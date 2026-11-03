# 🚀 PDFZen — Boxy Gen Z Multi-Color PDF Suite & OmniConvert

A **100% client-side, in-browser PDF power suite** featuring **27 dedicated tools** and an **OmniConvert** universal converter. Built with a vibrant Gen Z boxy neo-brutalist multi-color design, zero server uploads (complete privacy), **unlimited file capacity** for general tools, and a **5 GB memory protection limit** for sensitive security operations.

![PDFZen Preview](https://img.shields.io/badge/Privacy-100%25%20Client--Side-brightgreen?style=for-the-badge)
![Tools](https://img.shields.io/badge/Tools-27%20Power%20Tools-blueviolet?style=for-the-badge)
![Aesthetic](https://img.shields.io/badge/Design-Neo--Brutalist%20Gen%20Z-yellow?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## ⚡ Highlights & Features

### 🔒 1. 100% In-Browser Privacy
- **Zero Server Uploads**: Every byte is processed directly in client RAM via WebAssembly and HTML5 Canvas.
- **Zero Data Leakage**: Your sensitive documents, financial reports, legal contracts, and personal IDs never leave your device.
- **Offline Capable**: Works completely offline without needing cloud backends or external APIs.

### 📦 2. Unlimited File Capacity & Multi-GB Protection
- **Unlimited General Tools**: Merge, Split, Compress, Convert, Edit, and Annotate have **100% unlimited file size capacity** with zero arbitrary caps.
- **5 GB Sensitive Safeguard**: Security tools (Protect, Unlock, Sign, Redact) feature a generous **5 GB memory protection ceiling** to guarantee cryptographic stability in browser memory.
- **Aggressive RAM Cleanup**: Active buffer deallocation and garbage collection release memory immediately upon workspace reset.

### 🎨 3. Neo-Brutalist Boxy Gen Z Multi-Color UI
- **Distinctive Aesthetics**: Bold 3px solid black borders, high-contrast candy colors (Cyber Lime, Electric Yellow, Hot Pink, Digital Cyan, Coral Orange), and hard drop shadows (`4px 4px 0px #000`).
- **Dark & Light Mode**: Seamless single-click theme toggle with persistent preference state.
- **Quick Command Palette**: Instant keyboard-driven tool launcher (`Ctrl+K` or `/`) with auto-focus search.

### 📱 4. Mobile & Tablet Ergonomics
- **Floating Bottom Dock**: Frosted-glass neo-brutalist navigation dock for thumb-friendly navigation on mobile devices.
- **Touch-Optimized**: Zero-delay touch interactions (`touch-action: manipulation`), responsive signature drawing canvas, and swipeable category pills.

---

## 🧰 The Complete 27-Tool Suite

| Category | Tools Included | Capabilities |
|---|---|---|
| **📁 Organize** | **Merge PDF**, **Split PDF**, **Organize PDF**, **Remove Pages**, **Extract Pages**, **Compare PDF Diff** | Resequencing, custom page ranges, visual diffing, and revision overlay delta analysis. |
| **⚡ Optimize** | **Compress PDF**, **Repair PDF**, **Grayscale / B&W**, **Text-to-Speech Reader** | Lossless downsampling, xref table recovery, ITU-R grayscale conversion, Web Speech narrator. |
| **🔄 Convert** | **JPG to PDF**, **PDF to JPG**, **HTML to PDF**, **OCR & Extract Text**, **PDF to Word (.docx)**, **PDF to PowerPoint (.pptx)**, **PDF to Excel (.xlsx)** | Genuine OpenXML PresentationML, SpreadsheetML, WordprocessingML, WebP transcoding, and Tesseract OCR. |
| **✏️ Edit** | **Rotate PDF**, **Page Numbers**, **Watermark PDF**, **Edit PDF Annotator**, **Crop PDF Viewport**, **PDF Metadata Editor** | Lossless vector box cropping, document info metadata editing, freehand touch drawing, text stamps. |
| **🛡️ Security** | **Protect PDF**, **Unlock PDF**, **Sign PDF**, **Redact & Sanitize** | AES encryption, restriction stripping, digital signature stamping, and permanent vector text blackout burn. |

---

## 🌐 OmniConvert Universal Converter (`#universal`)

OmniConvert allows bidirectional conversion between virtually any document, table, image, and text format:

- **PDF ➔** `.docx`, `.pptx`, `.xlsx`, `.jpg`, `.png`, `.webp`, `.txt`, `.html`
- **PPTX ➔** `.pdf`, `.txt`, `.html`
- **XLSX ➔** `.pdf` (Styled Table Report), `.csv`, `.json`, `.docx` (Word Table)
- **CSV / JSON ➔** `.xlsx` (OpenXML Workbook), `.pdf` (Styled Table), `.docx` (Word Table), `.csv`, `.json`
- **DOCX ➔** `.pdf`, `.pptx` (Slide Deck), `.txt`, `.html`
- **Images (JPG / PNG / WebP / SVG) ➔** `.pdf`, `.png`, `.jpg`, `.webp`
- **Text / Markdown / HTML ➔** `.pdf`, `.docx`, `.html`, `.txt`

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)

### Installation & Launch

```bash
# 1. Clone the repository
git clone https://github.com/GovindTripathi22/PDF-MErger.git
cd PDF-MErger

# 2. Install dev dependencies (Puppeteer for test suite)
npm install

# 3. Start the local server
npm start
# or
npm run dev
```

Open your browser at **`http://localhost:3000`** to start using PDFZen!

### Direct Route Access
- **Universal Converter**: `http://localhost:3000/#universal`
- **Specific Tools**: `http://localhost:3000/#tool-merge`, `http://localhost:3000/#tool-compress`, `http://localhost:3000/#tool-protect`, etc.

---

## 🧪 Testing & Quality Assurance

PDFZen includes comprehensive automated verification suites:

```bash
# Run the 20-point technical unit and integration suite
npm test

# Run the end-to-end real Chrome browser audit
node browser_full_audit.js

# Run the deep-dive Universal Converter browser audit
node test_universal_page.js
```

---

## 📚 Built With

- **[PDF-Lib](https://pdf-lib.js.org/)** — Client-side PDF generation, merging, splitting, drawing, and vector manipulation
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — In-browser PDF rendering, text extraction, coordinate extraction, and page rasterization
- **[JSZip](https://stuk.github.io/jszip/)** — OpenXML packaging for DOCX, PPTX, and XLSX archives
- **[Tesseract.js](https://tesseract.projectnaptha.com/)** — In-browser Optical Character Recognition (OCR)
- **[Tailwind CSS](https://tailwindcss.com/)** — Rapid neobrutalist styling and design system
- **Google Material Symbols & Fonts** — Space Grotesk typographic hierarchy

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
