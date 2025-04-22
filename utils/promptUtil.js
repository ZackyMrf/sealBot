const readline = require('readline');
const { logger } = require('../services/logger');

/**
 * Utility function to prompt the user for input via command line
 * 
 * @param {string} question - The prompt text to display to the user
 * @returns {Promise<string>} - A promise that resolves to the user's input (trimmed)
 */
async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  } catch (error) {
    logger.error(`Error getting user input: ${error.message}`);
    rl.close();
    return '';
  }
}

/**
 * Prompts user for a yes/no choice
 * 
 * @param {string} question - The question to ask
 * @returns {Promise<boolean>} - True for yes, false for no
 */
async function promptYesNo(question) {
  const answer = await promptUser(`${question} (y/n): `);
  return answer.toLowerCase() === 'y';
}

/**
 * Prompts user for a numeric input with validation
 * 
 * @param {string} question - The question to ask
 * @param {number} defaultValue - Default value if input is invalid
 * @returns {Promise<number>} - The validated numeric input
 */
async function promptNumber(question, defaultValue = 1) {
  const input = await promptUser(question);
  const number = parseInt(input || defaultValue.toString(), 10);
  
  if (isNaN(number) || number < 1) {
    logger.warning(`Invalid number. Using default value of ${defaultValue}.`);
    return defaultValue;
  }
  
  return number;
}

module.exports = {
  promptUser,
  promptYesNo,
  promptNumber
};