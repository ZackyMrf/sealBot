const path = require('path');
const { getFullnodeUrl } = require('@mysten/sui.js/client');

// Core constants
const PACKAGE_ID = '0x4cb081457b1e098d566a277f605ba48410e26e66eaab5b3be4f6c560e9501800';
const SUI_RPC_URL = process.env.SUI_RPC_URL || getFullnodeUrl('testnet');
const DEFAULT_IMAGE_URL = 'https://picsum.photos/800/600';
const LOCAL_IMAGE_PATH = path.join(__dirname, '..', 'image.jpg');

// Publisher endpoints
const PUBLISHER_URLS = [
  'https://seal-example.vercel.app/publisher1/v1/blobs',
  'https://seal-example.vercel.app/publisher2/v1/blobs',
  'https://seal-example.vercel.app/publisher3/v1/blobs',
  'https://seal-example.vercel.app/publisher4/v1/blobs',
  'https://seal-example.vercel.app/publisher5/v1/blobs',
  'https://seal-example.vercel.app/publisher6/v1/blobs',
];

// UI symbols for logging
const SYMBOLS = {
  info: '📌',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  processing: '🔄',
  wallet: '👛',
  upload: '📤',
  download: '📥',
  network: '🌐',
  divider: '═════════════════════════════════════════'
};

// Export all constants
module.exports = {
  PACKAGE_ID,
  SUI_RPC_URL,
  DEFAULT_IMAGE_URL,
  LOCAL_IMAGE_PATH,
  PUBLISHER_URLS,
  SYMBOLS
};