const http = require('http');
const fs = require('fs');
const path = require('path');

const INITIAL_PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT_DIR = __dirname;
const MAX_PORT_ATTEMPTS = 20;

// Global process error handlers to ensure 100% server uptime
process.on('uncaughtException', (err) => {
  console.error('⚠️ Caught unhandled process exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Caught unhandled promise rejection:', reason);
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function handleRequest(req, res) {
  try {
    if (typeof req.on === 'function') {
      req.on('error', (err) => {
        console.warn('⚠️ Incoming request socket error:', err.message);
      });
    }
    if (typeof res.on === 'function') {
      res.on('error', (err) => {
        console.warn('⚠️ Outgoing response socket error:', err.message);
      });
    }

    // Normalize request URL
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('400 Bad Request');
      return;
    }

    let pathname = parsedUrl.pathname;
    
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Protect against null bytes and path traversal
    if (pathname.includes('\0')) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('400 Bad Request');
      return;
    }

    const safeSuffix = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT_DIR, safeSuffix);

    // If directory requested, look for index.html inside
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch (e) {
      filePath = path.join(ROOT_DIR, 'index.html');
    }

    // Fallback to index.html for SPA routing if file does not exist
    if (!fs.existsSync(filePath)) {
      filePath = path.join(ROOT_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`500 Server Error: ${err.code}`);
        }
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    });
  } catch (outerErr) {
    console.error('⚠️ Unexpected error handling request:', outerErr);
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    } catch (e) {}
  }
}

function startServer(port, attemptsLeft = MAX_PORT_ATTEMPTS, callback) {
  const server = http.createServer(handleRequest);

  server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket || !socket.writable) return;
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch (e) {}
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      try { server.close(); } catch (e) {}
      startServer(port + 1, attemptsLeft - 1, callback);
    } else {
      console.error(`❌ Server error:`, err);
    }
  });

  server.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 PDFZen Development Server Running!`);
    console.log(`👉 Local:   http://localhost:${port}`);
    console.log(`👉 Network: http://127.0.0.1:${port}`);
    console.log(`⚡ 100% Client-Side In-Browser Processing`);
    console.log(`=================================================\n`);
    if (typeof callback === 'function') {
      callback(server, port);
    }
  });

  // Keep event loop alive
  setInterval(() => {}, 1000 * 60 * 60);

  return server;
}

if (require.main === module) {
  startServer(INITIAL_PORT);
}

module.exports = { startServer, handleRequest, INITIAL_PORT, MIME_TYPES };
