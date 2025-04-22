const fs = require('fs');
const { logger } = require('../services/logger');

/**
 * Manages wallet loading and access from file
 */
class WalletManager {
  /**
   * Creates a new WalletManager instance
   * @param {string} walletFilePath - Path to the file containing wallet keys or mnemonics
   */
  constructor(walletFilePath) {
    this.walletFilePath = walletFilePath;
    this.wallets = [];
    this.loadWallets();
  }

  /**
   * Loads wallets from the specified file
   * Each line in the file should contain a private key, mnemonic, or other supported key format
   */
  loadWallets() {
    try {
      if (fs.existsSync(this.walletFilePath)) {
        const walletData = fs.readFileSync(this.walletFilePath, 'utf8');
        this.wallets = walletData
          .split('\n')
          .map(phrase => phrase.trim())
          .filter(phrase => phrase && !phrase.startsWith('#'));
        
        logger.success(`Loaded ${this.wallets.length} wallet(s) from ${this.walletFilePath}`);
      } else {
        logger.warning(`Wallet file ${this.walletFilePath} not found.`);
        this.wallets = [];
      }
    } catch (error) {
      logger.error(`Error loading wallets: ${error.message}`);
      this.wallets = [];
    }
  }

  /**
   * Gets all loaded wallets
   * @returns {string[]} Array of wallet keys/mnemonics
   */
  getWallets() {
    return this.wallets;
  }

  /**
   * Checks if any wallets are available
   * @returns {boolean} True if wallets are loaded, false otherwise
   */
  hasWallets() {
    return this.wallets.length > 0;
  }

  /**
   * Gets the number of loaded wallets
   * @returns {number} The count of loaded wallets
   */
  getWalletCount() {
    return this.wallets.length;
  }

  /**
   * Gets a specific wallet by index
   * @param {number} index - The index of the wallet to retrieve
   * @returns {string|null} The wallet key/mnemonic or null if not found
   */
  getWalletAtIndex(index) {
    if (index >= 0 && index < this.wallets.length) {
      return this.wallets[index];
    }
    return null;
  }
}

module.exports = { WalletManager };