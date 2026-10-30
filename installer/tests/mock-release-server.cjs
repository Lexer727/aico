const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const mode = process.argv[2] || 'equal';
const port = parseInt(process.argv[3] || '48991', 10);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aico_mock_release_'));
const mockSrc = path.join(tempDir, 'src');
fs.mkdirSync(mockSrc, { recursive: true });
fs.writeFileSync(path.join(mockSrc, 'aico-server.exe'), 'MOCK_V0_3_0_SERVER_BINARY');

const zipPath = path.join(tempDir, 'aico-windows-x64.zip');
// Zip using powershell Compress-Archive
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${mockSrc}\\*' -DestinationPath '${zipPath}' -Force"`);

const zipBuf = fs.readFileSync(zipPath);
const realHash = crypto.createHash('sha256').update(zipBuf).digest('hex');

const shaContent = mode === 'bad_hash' 
  ? '0000000000000000000000000000000000000000000000000000000000000000  aico-windows-x64.zip'
  : `${realHash}  aico-windows-x64.zip`;

const server = http.createServer((req, res) => {
  if (req.url === '/release') {
    if (mode === 'equal') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tag_name: 'v0.2.0', assets: [] }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        tag_name: 'v0.3.0',
        assets: [
          { name: 'aico-windows-x64.zip', browser_download_url: `http://127.0.0.1:${port}/download/zip` },
          { name: 'aico-windows-x64.zip.sha256', browser_download_url: `http://127.0.0.1:${port}/download/sha` }
        ]
      }));
    }
  } else if (req.url === '/download/zip') {
    res.writeHead(200, { 'Content-Type': 'application/zip' });
    res.end(zipBuf);
  } else if (req.url === '/download/sha') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(shaContent);
  } else if (req.url === '/shutdown') {
    res.writeHead(200);
    res.end('ok');
    setTimeout(() => {
      server.close();
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }, 100);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`READY on port ${port}`);
});

// Auto-terminate after 20 seconds
setTimeout(() => {
  server.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}, 20000);
