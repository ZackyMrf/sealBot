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
const { DEFAULT_IMAGE_URL, LOCAL_IMAGE_PATH } = require('./config/constanst');

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
  // Check if running in scheduled mode
  const isScheduled = process.argv.includes('--scheduled');
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
  
  // Initialize file paths
  const proxyPath = path.join(__dirname, 'proxies.txt');
  const walletPath = path.join(__dirname, 'wallets.txt');
  const pkPath = path.join(__dirname, 'private_key.txt');
  
  // Initialize services with loading spinner
  const spinner = ora('Initializing services...').start();
  const proxyManager = new ProxyManager(proxyPath);
  const walletManager = new WalletManager(walletPath);
  spinner.succeed('Services initialized successfully');
  
  // Load wallets from multiple sources
  let wallets = [];
  
  // Try to load wallets from wallets.txt
  if (walletManager.hasWallets()) {
    if (isScheduled || await promptYesNo(chalk.blue('\n➤ Multiple wallets detected. Use them?'))) {
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
  
  // If running in scheduled mode, use default options
  if (isScheduled) {
    logger.info('Running in scheduled mode with default options');
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
  
  try {
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
    if ((choice === '1' || choice === '3') && !isScheduled) {
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
      
      console.log(chalk.gray('\n  ' + '━'.repeat(50)));
      console.log(chalk.white.bold(`\n  WALLET ${walletIndex+1}/${wallets.length}`));
      
      // Initialize wallet
      const walletSpinner = ora('Initializing wallet...').start();
      const bot = new SuiAllowlistBot(privateKey, proxyManager);
      walletSpinner.succeed(`Wallet ready: ${chalk.cyan(bot.getAddress())}`);
      
      // Create allowlist if choice is 1 or 3
      if (choice === '1' || choice === '3') {
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
      }
      
      // Create service subscription if choice is 2 or 3
      if (choice === '2' || choice === '3') {
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
      }
    }
    
    console.log(chalk.gray('\n  ' + '━'.repeat(50)));
    console.log(chalk.green.bold('\n  ✅ ALL TASKS COMPLETED SUCCESSFULLY!'));
  } catch (error) {
    console.log(chalk.red.bold(`\n  ❌ ERROR: ${error.message}`));
  } finally {
    console.log(chalk.gray('\n  ' + '━'.repeat(50)));
    process.exit(0);
  }
}

// Run the application
main();