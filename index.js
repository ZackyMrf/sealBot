const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const axios = require('axios');
require('dotenv').config();

// Import local modules
const { logger } = require('./services/logger');
const { promptUser, promptYesNo, promptNumber } = require('./utils/promptUtil');
const { ProxyManager } = require('./utils/proxyManager');
const { WalletManager } = require('./utils/walletManager');
const { SuiAllowlistBot } = require('./utils/suiBot');
const { DEFAULT_IMAGE_URL, LOCAL_IMAGE_PATH, SUI_RPC_URL } = require('./config/constanst');

// File paths
const FAILED_WALLETS_FILE = path.join(__dirname, 'failed_wallets.txt');

/**
 * Tests connection to the SUI network
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  try {
    const spinner = ora('Testing connection to SUI network...').start();
    const response = await axios.post(SUI_RPC_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getLatestCheckpointSequenceNumber',
      params: []
    }, { timeout: 10000 });
    
    if (response.data && response.data.result) {
      spinner.succeed(`Connected to SUI network. Latest checkpoint: ${response.data.result}`);
      return true;
    } else {
      spinner.fail('Connection test failed: Invalid response');
      return false;
    }
  } catch (error) {
    console.error(`Connection error: ${error.message}`);
    return false;
  }
}

/**
 * Checks if proxy file exists and warns if missing
 * @param {string} proxyPath - Path to the proxy file
 * @returns {Promise<boolean>} True if should continue, false to exit
 */
async function checkProxyFile(proxyPath) {
  if (!fs.existsSync(proxyPath)) {
    console.log(chalk.yellow.bold('\n  ⚠️ WARNING: proxies.txt file not found!'));
    console.log(chalk.white('  Running without proxies may lead to rate limiting or IP bans.'));
    console.log(chalk.white('  Create a proxies.txt file with one proxy per line in the format host:port:username:password'));
    
    // If in scheduled mode, just warn and continue
    if (process.argv.includes('--scheduled') || process.argv.includes('--retry-failed')) {
      logger.warning('Running in scheduled mode without proxies.');
      return true;
    }
    
    // Otherwise ask the user if they want to continue
    const continueWithoutProxy = await promptYesNo(chalk.blue('\n➤ Continue without proxies?'));
    return continueWithoutProxy;
  }
  return true;
}

/**
 * Generates a random image URL from reliable image APIs
 * @returns {Promise<string>} Random image URL
 */
async function getRandomImageUrl() {
  const spinner = ora('Fetching random image...').start();
  
  // Common parameters
  const randomId = Math.floor(Math.random() * 10000);
  const width = 800;
  const height = 600;
  
  // List of reliable image sources (in order of preference)
  const imageSources = [
    `https://picsum.photos/${width}/${height}?random=${randomId}`,
    `https://picsum.photos/seed/${randomId}/${width}/${height}`,
    `https://source.unsplash.com/random/${width}x${height}/?sig=${randomId}`,
    `https://loremflickr.com/${width}/${height}?lock=${randomId}`
  ];
  
  // Try each source in order until we find one that works
  for (let i = 0; i < imageSources.length; i++) {
    const source = imageSources[i];
    try {
      spinner.text = `Trying image source ${i+1}/${imageSources.length}...`;
      
      // Set a timeout to avoid hanging
      await axios.head(source, { timeout: 5000 });
      
      spinner.succeed(`Image source found: ${chalk.cyan(source)}`);
      return source;
    } catch (error) {
      // If this is the last source, we'll fall back to default
      if (i === imageSources.length - 1) {
        spinner.fail(`All image sources failed. Using default image.`);
        return DEFAULT_IMAGE_URL;
      }
      // Otherwise, try the next source
      continue;
    }
  }
  
  // Fallback in case the loop somehow exits without returning
  spinner.fail(`Unexpected error fetching images. Using default image.`);
  return DEFAULT_IMAGE_URL;
}

/**
 * Main application function
 */
async function main() {
  // Track failed wallets - defined here for scope in finally block
  const failedWallets = new Set();
  
  try {
    // Check if running in scheduled mode
    const isScheduled = process.argv.includes('--scheduled');
    const isRetryFailed = process.argv.includes('--retry-failed');
    let choice, imageChoice, count;
    
    // Display app banner
    console.clear();
    console.log(
      chalk.cyan(
        figlet.textSync('SUI SEAL', {
          font: 'Standard',
          horizontalLayout: 'full'
        })
      )
    );
    console.log(chalk.white.bold('  Mrf  ') + chalk.magenta.bold('v3.0\n'));
    console.log(chalk.gray('  ' + '━'.repeat(50)));
    
    // Test connection to SUI network
    if (!(await testConnection())) {
      logger.error('Failed to connect to SUI network. Please check your network settings.');
      process.exit(1);
    }
    
    // Initialize file paths
    const proxyPath = path.join(__dirname, 'proxies.txt');
    const walletPath = path.join(__dirname, 'wallets.txt');
    const pkPath = path.join(__dirname, 'private_key.txt');
    
    // Check for proxy file first
    const shouldContinue = await checkProxyFile(proxyPath);
    if (!shouldContinue) {
      logger.error('Exiting due to missing proxies.txt file.');
      process.exit(1);
    }
    
    // Initialize services with loading spinner
    const spinner = ora('Initializing services...').start();
    const proxyManager = new ProxyManager(proxyPath);
    const walletManager = new WalletManager(walletPath);
    spinner.succeed('Services initialized successfully');
    
    // Load wallets from multiple sources
    let wallets = [];
    
    // Try to load wallets from wallets.txt
    if (walletManager.hasWallets()) {
      if (isScheduled || isRetryFailed || await promptYesNo(chalk.blue('\n➤ Multiple wallets detected. Use them?'))) {
        wallets = walletManager.getWallets();
        logger.info(`Using ${chalk.green(wallets.length)} wallets from wallets.txt`);
      }
    }
    
    // If no wallets loaded yet, try the single wallet file
    if (wallets.length === 0) {
      if (fs.existsSync(pkPath)) {
        const privateKey = fs.readFileSync(pkPath, 'utf8').trim();
        wallets = [privateKey];
        logger.info('Using wallet from private_key.txt');
      } else {
        logger.error('No wallet found. Please create private_key.txt or wallets.txt with your passphrase(s).');
        process.exit(1);
      }
    }
    
    // If retrying only failed wallets, filter the list
    if (isRetryFailed && fs.existsSync(FAILED_WALLETS_FILE)) {
      const failedAddresses = fs.readFileSync(FAILED_WALLETS_FILE, 'utf8')
        .split('\n')
        .filter(line => line.trim());
      
      if (failedAddresses.length > 0) {
        logger.info(`Found ${failedAddresses.length} failed addresses for retry`);
        
        // Filter wallets to only include those with addresses in the failed list
        const filteredWallets = [];
        const failedWalletAddresses = new Set(failedAddresses);
        
        for (const wallet of wallets) {
          try {
            const tempBot = new SuiAllowlistBot(wallet, proxyManager);
            const address = tempBot.getAddress();
            if (failedWalletAddresses.has(address)) {
              filteredWallets.push(wallet);
              logger.info(`Added wallet with address ${address} to retry list`);
            }
          } catch (e) {
            // Skip wallets that can't be initialized
            logger.error(`Could not initialize wallet: ${e.message}`);
          }
        }
        
        wallets = filteredWallets;
        logger.info(`Will retry ${wallets.length} failed wallets`);
      }
    }
    
    // If running in scheduled mode, use default options
    if (isScheduled || isRetryFailed) {
      logger.info('Running with default options');
      choice = '3';  // Run both tasks
      imageChoice = '3';  // Use random image
      count = 1;  // Default task count
      let additionalAddresses = [];
    } else {
      // Task selection with styled menu
      console.log(chalk.gray('\n  ' + '━'.repeat(50)));
      console.log(chalk.white.bold('\n  AVAILABLE ACTIONS:'));
      console.log(chalk.green('  [1]') + chalk.white(' Create Allowlist and Publish Blob'));
      console.log(chalk.green('  [2]') + chalk.white(' Create Service Subscription and Upload Blob'));
      console.log(chalk.green('  [3]') + chalk.white(' Run Both Tasks (1 & 2) Simultaneously'));
      choice = await promptUser(chalk.blue('\n➤ Select an action (1/2/3): '));
      
      if (!['1', '2', '3'].includes(choice)) {
        logger.error('Invalid choice. Please enter 1, 2, or 3.');
        process.exit(1);
      }
      
      // Image source selection with styled menu
      console.log(chalk.gray('\n  ' + '━'.repeat(50)));
      console.log(chalk.white.bold('\n  IMAGE SOURCE:'));
      console.log(chalk.green('  [1]') + chalk.white(' Use URL (default: random image from picsum)'));
      console.log(chalk.green('  [2]') + chalk.white(' Use local file (image.jpg in script directory)'));
      console.log(chalk.green('  [3]') + chalk.white(' Generate random image from API'));
      imageChoice = await promptUser(chalk.blue('\n➤ Choose image source (1/2/3): '));
      
      // Task count with improved visual feedback
      count = await promptNumber(chalk.blue('\n➤ Enter number of tasks per wallet (default 1): '), 1);
      console.log(chalk.green(`✓ Will perform ${count} task(s) per wallet`));
    }
    
    let imageSource;
    const imageSpinner = ora('Configuring image source...').start();
    
    if (imageChoice === '2') {
      if (!fs.existsSync(LOCAL_IMAGE_PATH)) {
        imageSpinner.fail('Error: image.jpg not found in script directory.');
        process.exit(1);
      }
      imageSource = LOCAL_IMAGE_PATH;
      imageSpinner.succeed('Using local image.jpg');
    } else if (imageChoice === '3') {
      imageSpinner.text = 'Generating random image URL...';
      imageSource = await getRandomImageUrl();
      imageSpinner.succeed(`Using random image URL: ${chalk.cyan(imageSource)}`);
    } else {
      imageSource = await promptUser(chalk.blue('➤ Enter image URL (or press Enter for default): ')) || DEFAULT_IMAGE_URL;
      imageSpinner.succeed(`Using image URL: ${chalk.cyan(imageSource)}`);
    }
    
    // Additional addresses for allowlist
    let additionalAddresses = [];
    if ((choice === '1' || choice === '3') && !isScheduled && !isRetryFailed) {
      const addressesInput = await promptUser(chalk.blue('\n➤ Enter additional addresses for allowlist (comma-separated, or press Enter for none): '));
      if (addressesInput.trim()) {
        additionalAddresses = addressesInput
          .split(',')
          .map(addr => addr.trim())
          .filter(addr => addr);
        console.log(chalk.green(`✓ Will add ${additionalAddresses.length} additional address(es) to each allowlist`));
      }
    }
    
    // Process each wallet
    for (let walletIndex = 0; walletIndex < wallets.length; walletIndex++) {
      const privateKey = wallets[walletIndex];
      let walletAddress = '';
      
      console.log(chalk.gray('\n  ' + '━'.repeat(50)));
      console.log(chalk.white.bold(`\n  WALLET ${walletIndex+1}/${wallets.length}`));
      
      try {
        // Initialize wallet
        const walletSpinner = ora('Initializing wallet...').start();
        const bot = new SuiAllowlistBot(privateKey, proxyManager);
        walletAddress = bot.getAddress();
        walletSpinner.succeed(`Wallet ready: ${chalk.cyan(walletAddress)}`);
        
        let allowlistSuccess = true;
        let serviceSuccess = true;
        
        // Create allowlist if choice is 1 or 3
        if (choice === '1' || choice === '3') {
          try {
            const allowlistSpinner = ora(`Starting allowlist workflow (${count} tasks)`).start();
            const allowlistResults = await bot.runAllowlistWorkflow(imageSource, additionalAddresses, count);
            allowlistSpinner.succeed('Allowlist workflow completed');
            
            console.log(chalk.white.bold('\n  ALLOWLIST RESULTS:'));
            allowlistResults.forEach((result, idx) => {
              console.log(chalk.cyan(`\n  Allowlist ${idx+1}:`));
              console.log(chalk.white(`    ◆ Allowlist ID: `) + chalk.yellow(result.allowlistId));
              console.log(chalk.white(`    ◆ Entry ID:     `) + chalk.yellow(result.entryObjectId));
              console.log(chalk.white(`    ◆ Blob ID:      `) + chalk.yellow(result.blobId));
            });
          } catch (error) {
            allowlistSuccess = false;
            console.log(chalk.red.bold(`\n  ❌ Allowlist workflow failed: ${error.message}`));
            failedWallets.add(walletAddress);
          }
        }
        
        // Create service subscription if choice is 2 or 3
        if (choice === '2' || choice === '3') {
          try {
            // If running both tasks, get a new random image for the second task
            if (choice === '3' && imageChoice === '3') {
              const newImageSpinner = ora('Generating a new random image for service subscription...').start();
              imageSource = await getRandomImageUrl();
              newImageSpinner.succeed(`Using new random image URL: ${chalk.cyan(imageSource)}`);
            }
            
            const serviceSpinner = ora(`Starting service subscription workflow (${count} tasks)`).start();
            const serviceResults = await bot.runServiceSubscriptionWorkflow(imageSource, count);
            serviceSpinner.succeed('Service subscription workflow completed');
            
            console.log(chalk.white.bold('\n  SERVICE RESULTS:'));
            serviceResults.forEach((result, idx) => {
              console.log(chalk.cyan(`\n  Service ${idx+1}:`));
              console.log(chalk.white(`    ◆ Shared ID:   `) + chalk.yellow(result.sharedObjectId));
              console.log(chalk.white(`    ◆ Entry ID:    `) + chalk.yellow(result.serviceEntryId));
              console.log(chalk.white(`    ◆ Blob ID:     `) + chalk.yellow(result.blobId));
            });
          } catch (error) {
            serviceSuccess = false;
            console.log(chalk.red.bold(`\n  ❌ Service subscription workflow failed: ${error.message}`));
            failedWallets.add(walletAddress);
          }
        }
        
        if (allowlistSuccess && serviceSuccess) {
          console.log(chalk.green.bold('\n  ✅ Wallet tasks completed successfully!'));
        } else {
          console.log(chalk.yellow.bold('\n  ⚠️ Some wallet tasks failed!'));
        }
      } catch (error) {
        console.log(chalk.red.bold(`\n  ❌ Error processing wallet: ${error.message}`));
        if (walletAddress) {
          failedWallets.add(walletAddress);
        }
      }
    }
    
    // Save failed wallet addresses to file for retry
    if (failedWallets.size > 0) {
      fs.writeFileSync(FAILED_WALLETS_FILE, Array.from(failedWallets).join('\n'), 'utf8');
      console.log(chalk.yellow.bold(`\n  ⚠️ ${failedWallets.size} wallets failed and saved for retry.`));
    } else {
      // Clean up failed wallets file if all wallets succeeded
      if (fs.existsSync(FAILED_WALLETS_FILE)) {
        fs.unlinkSync(FAILED_WALLETS_FILE);
      }
      console.log(chalk.green.bold('\n  ✅ ALL TASKS COMPLETED SUCCESSFULLY!'));
    }
  } catch (error) {
    console.log(chalk.red.bold(`\n  ❌ ERROR: ${error.message}`));
  } finally {
    console.log(chalk.gray('\n  ' + '━'.repeat(50)));
    process.exit(failedWallets.size > 0 ? 1 : 0);
  }
}

// Run the application
main();