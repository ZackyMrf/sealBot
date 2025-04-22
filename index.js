const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const axios = require('axios');
require('dotenv').config();

// Import local modules
const { logger } = require('./services/logger');
const { promptUser, promptNumber } = require('./utils/promptUtil');
const { ProxyManager } = require('./utils/proxyManager');
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
  console.log(chalk.white.bold('  Mrf  ') + chalk.magenta.bold('v2.1\n'));
  console.log(chalk.gray('  ' + '━'.repeat(50)));
  
  // Initialize file paths
  const proxyPath = path.join(__dirname, 'proxies.txt');
  const pkPath = path.join(__dirname, 'private_key.txt');
  
  // Initialize services with loading spinner
  const spinner = ora('Initializing services...').start();
  const proxyManager = new ProxyManager(proxyPath);
  spinner.succeed('Services initialized successfully');
  
  // Load the private key
  if (!fs.existsSync(pkPath)) {
    logger.error('No wallet found. Please create private_key.txt with your passphrase.');
    process.exit(1);
  }
  
  const privateKey = fs.readFileSync(pkPath, 'utf8').trim();
  logger.info('Using wallet from private_key.txt');
  
  // Task selection with styled menu
  console.log(chalk.gray('\n  ' + '━'.repeat(50)));
  console.log(chalk.white.bold('\n  AVAILABLE ACTIONS:'));
  console.log(chalk.green('  [1]') + chalk.white(' Create Allowlist and Publish Blob'));
  console.log(chalk.green('  [2]') + chalk.white(' Create Service Subscription and Upload Blob'));
  console.log(chalk.green('  [3]') + chalk.white(' Run Both Tasks (1 & 2) Simultaneously'));
  const choice = await promptUser(chalk.blue('\n➤ Select an action (1/2/3): '));
  
  if (!['1', '2', '3'].includes(choice)) {
    logger.error('Invalid choice. Please enter 1, 2, or 3.');
    process.exit(1);
  }
  
  try {
    // Image source selection with styled menu
    console.log(chalk.gray('\n  ' + '━'.repeat(50)));
    console.log(chalk.white.bold('\n  IMAGE SOURCE:'));
    console.log(chalk.green('  [1]') + chalk.white(' Use URL (default: random image from picsum)'));
    console.log(chalk.green('  [2]') + chalk.white(' Use local file (image.jpg in script directory)'));
    console.log(chalk.green('  [3]') + chalk.white(' Generate random image from API'));
    const imageChoice = await promptUser(chalk.blue('\n➤ Choose image source (1/2/3): '));

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
    
    // Task count with improved visual feedback
    const count = await promptNumber(chalk.blue('\n➤ Enter number of tasks per wallet (default 1): '), 1);
    console.log(chalk.green(`✓ Will perform ${count} task(s)`));
    
    // Additional addresses for allowlist
    let additionalAddresses = [];
    if (choice === '1' || choice === '3') {
      const addressesInput = await promptUser(chalk.blue('\n➤ Enter additional addresses for allowlist (comma-separated, or press Enter for none): '));
      if (addressesInput.trim()) {
        additionalAddresses = addressesInput
          .split(',')
          .map(addr => addr.trim())
          .filter(addr => addr);
        console.log(chalk.green(`✓ Will add ${additionalAddresses.length} additional address(es) to each allowlist`));
      }
    }
    
    // Initialize wallet
    console.log(chalk.gray('\n  ' + '━'.repeat(50)));
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
