const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { logger } = require('./services/logger');

// Calculate a default schedule time (current time + 1 minute)
function getInitialScheduleTime() {
  const now = new Date();
  const minute = (now.getMinutes() + 1) % 60;
  const hour = minute === 0 ? (now.getHours() + 1) % 24 : now.getHours();
  
  return {
    minute,
    hour,
    cronString: `${minute} ${hour} * * *`
  };
}

const initialTime = getInitialScheduleTime();

// Configuration
const CONFIG_FILE = path.join(__dirname, 'schedule-config.json');
const DEFAULT_CONFIG = {
  schedule: initialTime.cronString,  // Default: run at current time + 1 minute, then daily
  maxRetries: 3,
  retryDelay: 300000       // 5 minutes in milliseconds
};

// Load configuration
let config = DEFAULT_CONFIG;
try {
  if (fs.existsSync(CONFIG_FILE)) {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    logger.info('Loaded scheduler configuration');
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    logger.info(`Created default scheduler configuration to run at ${initialTime.hour}:${initialTime.minute.toString().padStart(2, '0')} daily`);
  }
} catch (error) {
  logger.error(`Error loading configuration: ${error.message}`);
}

// Function to run the main script
function runScript(retry = 0) {
  logger.info(`Running scheduled task (attempt ${retry + 1}/${config.maxRetries + 1})`);
  
  exec('node index.js --scheduled', (error, stdout, stderr) => {
    if (error) {
      logger.error(`Execution error: ${error.message}`);
      if (retry < config.maxRetries) {
        logger.warning(`Retrying in ${config.retryDelay / 60000} minutes...`);
        setTimeout(() => runScript(retry + 1), config.retryDelay);
      }
      return;
    }
    
    logger.success('Scheduled task completed successfully');
    console.log(stdout);
    
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