const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, 'dist');

// Read SVG icon
let svgDataUri = '';
try {
  const svgPath = path.join(distDir, 'icons', 'icon.svg');
  if (fs.existsSync(svgPath)) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }
} catch (e) {
  console.warn('SVG icon could not be loaded:', e);
}

// Find CSS file
const assetsDir = path.join(distDir, 'assets');
const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) {
  throw new Error('No CSS found in dist/assets');
}
const cssContent = fs.readFileSync(path.join(assetsDir, cssFiles[0]), 'utf8');

// Find JS file
const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
if (jsFiles.length === 0) {
  throw new Error('No JS found in dist/assets');
}
const jsContent = fs.readFileSync(path.join(assetsDir, jsFiles[0]), 'utf8');

const singleHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>AgriVault | Storage Intelligence & Industrial IoT Platform</title>
    
    <!-- PWA & Mobile Web Capabilities -->
    <meta name="agrivault-deploy-marker" content="deploy-probe-998877" />
    <meta name="theme-color" content="#090d16" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="AgriVault" />
    <meta name="description" content="Production-ready real-time environmental monitoring and intelligent management of cold storages, grain warehouses, potato vaults, and food facilities." />
    
    <!-- Embedded Favicon & App Icon -->
    ${svgDataUri ? `<link rel="icon" type="image/svg+xml" href="${svgDataUri}" />\n    <link rel="apple-touch-icon" href="${svgDataUri}" />` : ''}

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    
    <!-- All Inlined Industrial CSS Styles -->
    <style>
${cssContent}
    </style>
    
    <!-- Standalone & Offline Compatibility -->
    <script>
      (function() {
        var fallbackSvg = "${svgDataUri}";
        window.addEventListener("error", function(e) {
          if (e.target && e.target.tagName === "IMG" && e.target.src && e.target.src.indexOf("logo.png") !== -1) {
            e.target.src = fallbackSvg;
          }
        }, true);

        // Fallback for direct local file execution (file://)
        if (window.location.protocol === "file:" || !window.location.host) {
          var originalFetch = window.fetch;
          window.fetch = function(url, init) {
            if (typeof url === "string" && url.indexOf("/api") === 0) {
              url = "http://localhost:4000" + url;
            }
            return originalFetch(url, init);
          };

          var OriginalWebSocket = window.WebSocket;
          window.WebSocket = function(url, protocols) {
            if (typeof url === "string" && (url.indexOf("ws:///") === 0 || url === "ws:///ws" || url === "ws://localhost/ws" || url.indexOf(":4000") === -1)) {
              url = "ws://localhost:4000/ws";
            }
            return new OriginalWebSocket(url, protocols);
          };
        }
      })();
    </script>
  </head>
  <body class="bg-vault-950 text-slate-100 antialiased selection:bg-agri-500 selection:text-white min-h-screen">
    <div id="root"></div>
    
    <!-- All Inlined Application JavaScript Bundle -->
    <script>
${jsContent}
    </script>
  </body>
</html>
`;

// 1. Output file in frontend root: agrivault_single.html
const outSingle = path.join(__dirname, 'agrivault_single.html');
fs.writeFileSync(outSingle, singleHtml, 'utf8');
console.log('[SUCCESS] Generated standalone bundle:', outSingle, `(${Math.round(singleHtml.length / 1024)} KB)`);

// 2. Also write to dist/index.html so backend serves it directly
const outDist = path.join(distDir, 'index.html');
fs.writeFileSync(outDist, singleHtml, 'utf8');
console.log('[SUCCESS] Updated dist/index.html for server delivery');

// 3. Backup original index.html if not already backed up
const devHtml = path.join(__dirname, 'index.dev.html');
const indexHtml = path.join(__dirname, 'index.html');
if (!fs.existsSync(devHtml)) {
  fs.copyFileSync(indexHtml, devHtml);
  console.log('[SUCCESS] Backed up original Vite entrypoint to index.dev.html');
}

// 4. Standalone bundle is ready at agrivault_single.html and dist/index.html
