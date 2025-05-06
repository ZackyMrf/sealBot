const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { logger } = require('./services/logger');

// Configuration
const CONFIG_FILE = path.join(__dirname, 'schedule-config.json');
const FAILED_WALLETS_FILE = path.join(__dirname, 'failed_wallets.txt');
const DEFAULT_CONFIG = {
  schedule: "58 16 * * *",
  maxRetries: 3,
  retryDelay: 300000,
  walletRetryLimit: 5  // New setting for per-wallet retry limit
};

// Load configuration
let config = DEFAULT_CONFIG;
try {
  if (fs.existsSync(CONFIG_FILE)) {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    logger.info('Loaded scheduler configuration');
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    logger.info('Created default scheduler configuration');
  }
} catch (error) {
  logger.error(`Error loading configuration: ${error.message}`);
}

// Function to parse output and identify failed wallets
function parseFailedWallets(output) {
  const lines = output.split('\n');
  const failedWallets = [];
  let currentWallet = null;
  
  for (let i = 0; i < lines.length; i++) {
    // Look for wallet address line
    if (lines[i].includes('Wallet ready:')) {
      // Extract the wallet address
      const addressMatch = lines[i].match(/Wallet ready: (0x[a-fA-F0-9]+)/);
      if (addressMatch && addressMatch[1]) {
        currentWallet = addressMatch[1];
      }
    }
    
    // Check for error messages after a wallet has been identified
    if (currentWallet && (
      lines[i].includes('❌ ERROR:') || 
      lines[i].includes('Error creating allowlist') ||
      lines[i].includes('Allowlist workflow failed') ||
      lines[i].includes('Service subscription workflow failed')
    )) {
      failedWallets.push(currentWallet);
      currentWallet = null; // Reset to avoid duplicate entries
    }
    
    // If we see successful completion for a wallet, reset current wallet
    if (currentWallet && lines[i].includes('✅ ALL TASKS COMPLETED SUCCESSFULLY!')) {
      currentWallet = null;
    }
  }
  
  return [...new Set(failedWallets)]; // Remove duplicates
}

// Function to save failed wallets for retry
function saveFailedWallets(wallets) {
  if (wallets.length > 0) {
    fs.writeFileSync(FAILED_WALLETS_FILE, wallets.join('\n'), 'utf8');
    logger.warning(`Saved ${wallets.length} failed wallets for retry`);
    return true;
  }
  return false;
}

// Function to load failed wallets
function loadFailedWallets() {
  if (fs.existsSync(FAILED_WALLETS_FILE)) {
    const content = fs.readFileSync(FAILED_WALLETS_FILE, 'utf8');
    const wallets = content.split('\n').filter(line => line.trim());
    if (wallets.length > 0) {
      logger.info(`Loaded ${wallets.length} failed wallets for retry`);
      return wallets;
    }
  }
  return null;
}

// Function to run the main script
function runScript(retry = 0, retryFailedOnly = false) {
  const failedWallets = loadFailedWallets();
  
  let command = 'node index.js --scheduled';
  if (retryFailedOnly && failedWallets) {
    command += ' --retry-failed';
    logger.info(`Running retry for ${failedWallets.length} failed wallets`);
  } else {
    logger.info(`Running scheduled task (attempt ${retry + 1}/${config.maxRetries + 1})`);
  }
  
  exec(command, (error, stdout, stderr) => {
    console.log(stdout); // Display output
    
    if (error) {
      logger.error(`Execution error: ${error.message}`);
      
      // Parse output to find failed wallets
      const failedWallets = parseFailedWallets(stdout);
      
      if (failedWallets.length > 0) {
        // Save failed wallets for retry
        if (saveFailedWallets(failedWallets)) {
          logger.warning(`Will retry with ${failedWallets.length} failed wallets in ${config.retryDelay / 60000} minutes`);
          setTimeout(() => runScript(retry, true), config.retryDelay);
          return;
        }
      }
      
      // If parsing failed or no failed wallets found, use regular retry
      if (retry < config.maxRetries) {
        logger.warning(`Retrying in ${config.retryDelay / 60000} minutes...`);
        setTimeout(() => runScript(retry + 1), config.retryDelay);
      }
      return;
    }
    
    logger.success('Scheduled task completed successfully');
    
    // Clean up failed wallets file if it exists
    if (fs.existsSync(FAILED_WALLETS_FILE)) {
      fs.unlinkSync(FAILED_WALLETS_FILE);
    }
    
    if (stderr) {
      logger.warning(`Script reported warnings: ${stderr}`);
    }
  });
}

// Schedule the task
logger.info(`Setting up scheduler with cron pattern: ${config.schedule}`);
cron.schedule(config.schedule, () => {
  logger.divider();
  logger.info(`Starting scheduled execution at ${new Date().toLocaleString()}`);
  runScript();
});

// Display next execution time
const [minute, hour] = config.schedule.split(' ');
logger.info(`Next execution will be at ${hour}:${minute.padStart(2, '0')} and then daily at that time`);
logger.success('Scheduler started! Waiting for scheduled execution times.');
logger.info('Press Ctrl+C to stop the scheduler.');

// Optionally run immediately for testing
if (process.argv.includes('--run-now')) {
  logger.info('--run-now flag detected, executing task immediately');
  setTimeout(runScript, 3000);
}