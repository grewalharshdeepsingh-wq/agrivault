const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('[AgriVault Build] 1/3 Compiling Frontend (Vite)...');
  execSync('npm run build --prefix frontend', { stdio: 'inherit' });

  console.log('[AgriVault Build] 2/3 Compiling Backend (TypeScript)...');
  execSync('npm run build --prefix backend', { stdio: 'inherit' });

  console.log('[AgriVault Build] 3/3 Syncing frontend/dist to public/...');
  const src = path.resolve(__dirname, '../frontend/dist');
  const dest = path.resolve(__dirname, '../public');
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  fs.cpSync(src, dest, { recursive: true });

  console.log('[AgriVault Build] Build finished successfully!');
} catch (err) {
  console.error('[AgriVault Build Error]', err);
  process.exit(1);
}
