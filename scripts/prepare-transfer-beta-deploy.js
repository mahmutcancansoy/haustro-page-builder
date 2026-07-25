#!/usr/bin/env node
/**
 * Transfer beta için güncel backend endpointlerini deploy/ klasörüne kopyalar.
 *
 *   node scripts/prepare-transfer-beta-deploy.js
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendCustomDir = path.resolve(
  projectRoot,
  '../HaustroBackend/Backend/src/routes/custom'
);
const deployDir = path.join(projectRoot, 'deploy');

const files = [
  'multiTransfer.php',
  'transferCreateBeta.php',
  'fastTransfer.php',
  'getNotifications.php',
  'getWaitingReports.php',
];

if (!fs.existsSync(backendCustomDir)) {
  throw new Error(`Backend custom route klasörü bulunamadı: ${backendCustomDir}`);
}

fs.mkdirSync(deployDir, { recursive: true });

for (const file of files) {
  const source = path.join(backendCustomDir, file);
  const target = path.join(deployDir, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Backend dosyası bulunamadı: ${source}`);
  }
  fs.copyFileSync(source, target);
  console.log(`${file} → ${path.relative(projectRoot, target)}`);
}

console.log(`Transfer beta deploy paketi hazır (${files.length} dosya).`);
