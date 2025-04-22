const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { getFullnodeUrl, SuiClient } = require('@mysten/sui.js/client');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { decodeSuiPrivateKey } = require('@mysten/sui.js/cryptography');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { logger } = require('../services/logger');
const { PACKAGE_ID, SUI_RPC_URL, PUBLISHER_URLS, DEFAULT_IMAGE_URL, LOCAL_IMAGE_PATH } = require('../config/constanst');

/**
 * SUI Blockchain interaction for allowlist and subscription operations
 */
class SuiAllowlistBot {
  /**
   * Creates a new SUI Allowlist bot instance
   * @param {string} keyInput - Private key or mnemonic for the wallet
   * @param {ProxyManager} proxyManager - Optional proxy manager for network requests
   */
  constructor(keyInput, proxyManager = null) {
    this.client = new SuiClient({ url: SUI_RPC_URL });
    this.proxyManager = proxyManager;
    this.address = this.initializeKeypair(keyInput);
  }

  /**
   * Initializes the keypair from various key formats
   * @param {string} keyInput - Key in various formats (mnemonic, hex, base64, etc.)
   * @returns {string} The wallet address
   */
  initializeKeypair(keyInput) {
    try {
      if (keyInput.startsWith('suiprivkey')) {
        const { secretKey } = decodeSuiPrivateKey(keyInput);
        this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
      } else if (keyInput.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(keyInput)) {
        const privateKeyBytes = Buffer.from(keyInput.startsWith('0x') ? keyInput.slice(2) : keyInput, 'hex');
        this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else if (/^[A-Za-z0-9+/=]+$/.test(keyInput) && keyInput.length === 44) {
        const privateKeyBytes = Buffer.from(keyInput, 'base64');
        this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } else {
        this.keypair = Ed25519Keypair.deriveKeypair(keyInput);
      }
      
      const address = this.keypair.getPublicKey().toSuiAddress();
      logger.info(`Initialized wallet with address: ${address}`);
      return address;
    } catch (error) {
      logger.error(`Error initializing keypair: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets the current wallet address
   * @returns {string} The wallet address
   */
  getAddress() {
    return this.address;
  }

  /**
   * Generates a random name for entities
   * @returns {string} A random name
   */
  generateRandomName() {
    const adjectives = ['cool', 'awesome', 'amazing', 'brilliant', 'excellent'];
    const nouns = ['project', 'creation', 'work', 'masterpiece', 'innovation'];
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdjective}-${randomNoun}-${randomNum}`;
  }

  /**
   * Creates an allowlist entry on the blockchain
   * @param {string} name - Optional name for the allowlist (random if not provided)
   * @returns {Promise<Object>} The created allowlist and entry IDs
   */
  async createAllowlist(name = null) {
    const entryName = name || this.generateRandomName();
    logger.processing(`Creating allowlist with name: ${entryName}`);
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::allowlist::create_allowlist_entry`,
      arguments: [txb.pure(entryName)],
    });
    txb.setGasBudget(10000000);

    try {
      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: { showEffects: true, showEvents: true },
        requestType: 'WaitForLocalExecution',
      });
      const createdObjects = result.effects?.created || [];
      const entryObjectId = createdObjects.find(obj => obj.owner?.AddressOwner === this.getAddress())?.reference?.objectId;
      const allowlistId = createdObjects.find(obj => obj.owner?.Shared)?.reference?.objectId;

      if (!allowlistId || !entryObjectId) {
        throw new Error('Failed to retrieve allowlistId or entryObjectId');
      }

      logger.success(`Allowlist created successfully`);
      logger.result('Allowlist ID', allowlistId);
      logger.result('Entry ID', entryObjectId);
      return { allowlistId, entryObjectId };
    } catch (error) {
      logger.error(`Error creating allowlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adds an address to an allowlist
   * @param {string} allowlistId - The allowlist ID
   * @param {string} entryObjectId - The entry object ID
   * @param {string} address - The address to add
   * @returns {Promise<Object>} Transaction result
   */
  async addToAllowlist(allowlistId, entryObjectId, address) {
    logger.processing(`Adding ${address} to allowlist`);
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::allowlist::add`,
      arguments: [
        txb.object(allowlistId),
        txb.object(entryObjectId),
        txb.pure(address),
      ],
    });
    txb.setGasBudget(10000000);

    try {
      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: { showEffects: true },
        requestType: 'WaitForLocalExecution',
      });
      logger.success(`Address added to allowlist successfully`);
      return result;
    } catch (error) {
      logger.error(`Error adding to allowlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a service entry for subscriptions
   * @param {number} amount - The amount for the service
   * @param {number} duration - The duration for the service
   * @param {string} name - Optional name for the service
   * @returns {Promise<Object>} The created service IDs
   */
  async addServiceEntry(amount, duration, name = null) {
    const serviceName = name || this.generateRandomName();
    logger.processing(`Adding service entry: ${serviceName} (Amount: ${amount}, Duration: ${duration})`);
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::subscription::create_service_entry`,
      arguments: [
        txb.pure(amount, 'u64'),
        txb.pure(duration, 'u64'),
        txb.pure(serviceName),
      ],
    });
    txb.setGasBudget(10000000);

    try {
      const result = await this.client.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: { showEffects: true },
        requestType: 'WaitForLocalExecution',
      });
      const createdObjects = result.effects?.created || [];
      const serviceEntryId = createdObjects.find(obj => obj.owner?.AddressOwner === this.getAddress())?.reference?.objectId;
      const sharedObjectId = createdObjects.find(obj => obj.owner?.Shared)?.reference?.objectId;

      if (!serviceEntryId || !sharedObjectId) {
        throw new Error('Failed to retrieve serviceEntryId or sharedObjectId');
      }

      logger.success(`Service entry created successfully`);
      logger.result('Shared ID', sharedObjectId);
      logger.result('Entry ID', serviceEntryId);
      return { sharedObjectId, serviceEntryId };
    } catch (error) {
      logger.error(`Error adding service entry: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetches image from a URL
   * @param {string} imageUrl - The URL to fetch the image from
   * @returns {Promise<Buffer>} The image data
   */
  async fetchImageFromUrl(imageUrl) {
    logger.download(`Fetching image from URL`);
    
    const axiosConfig = {};
    if (this.proxyManager) {
      const proxyAgent = this.proxyManager.createProxyAgent();
      if (proxyAgent) {
        axiosConfig.httpsAgent = proxyAgent;
      }
    }
    
    try {
      const response = await axios({
        method: 'get',
        url: imageUrl,
        responseType: 'arraybuffer',
        ...axiosConfig
      });
      const imageData = Buffer.from(response.data);
      logger.success(`Image fetched: ${(imageData.length / 1024).toFixed(2)} KB`);
      return imageData;
    } catch (error) {
      logger.error(`Error fetching image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Loads an image from the local filesystem
   * @param {string} imagePath - Path to the local image
   * @returns {Promise<Buffer>} The image data
   */
  async loadLocalImage(imagePath) {
    logger.download(`Loading local image`);
    try {
      const imageData = fs.readFileSync(imagePath);
      logger.success(`Image loaded: ${(imageData.length / 1024).toFixed(2)} KB`);
      return imageData;
    } catch (error) {
      logger.error(`Error loading local image: ${error.message}`);
      throw error;
    }
  }

  /**
   * Uploads a blob to the network
   * @param {string|Buffer} imageSource - URL, path, or image data
   * @param {number} epochs - Number of epochs for the blob
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<string>} The blob ID
   */
  async uploadBlob(imageSource, epochs = 1, maxRetries = 15) {
    let imageData;
    if (typeof imageSource === 'string' && imageSource.match(/^https?:\/\//)) {
      imageData = await this.fetchImageFromUrl(imageSource);
    } else if (typeof imageSource === 'string' && imageSource === LOCAL_IMAGE_PATH) {
      imageData = await this.loadLocalImage(imageSource);
    } else {
      imageData = imageSource;
    }

    logger.upload(`Uploading blob for ${epochs} epochs`);
    let attempt = 1;
    const delayMs = 5000;

    while (attempt <= maxRetries) {
      const randomIndex = Math.floor(Math.random() * PUBLISHER_URLS.length);
      const publisherUrl = `${PUBLISHER_URLS[randomIndex]}?epochs=${epochs}`;
      logger.processing(`Attempt ${attempt}: Using publisher${randomIndex + 1}`);

      try {
        const axiosConfig = {};
        if (this.proxyManager) {
          const proxyAgent = this.proxyManager.createProxyAgent();
          if (proxyAgent) {
            axiosConfig.httpsAgent = proxyAgent;
          }
        }

        const response = await axios({
          method: 'put',
          url: publisherUrl,
          headers: { 'Content-Type': 'application/octet-stream' },
          data: imageData,
          ...axiosConfig
        });

        let blobId;
        if (response.data && response.data.newlyCreated && response.data.newlyCreated.blobObject) {
          blobId = response.data.newlyCreated.blobObject.blobId;
          console.log('newlyCreated');
        } else if (response.data && response.data.alreadyCertified) {
          blobId = response.data.alreadyCertified.blobId;
          console.log('alreadyCertified');
        } else {
          throw new Error(`Invalid response structure from publisher`);
        }

        if (!blobId) {
          throw new Error(`Blob ID is missing in response`);
        }

        logger.success(`Blob uploaded successfully`);
        logger.result('Blob ID', blobId);
        return blobId;
      } catch (error) {
        logger.error(`Upload failed on attempt ${attempt}: ${error.message}`);
        if (attempt === maxRetries) {
          logger.error(`Max retries (${maxRetries}) reached. Giving up.`);
          throw new Error('Failed to upload blob after maximum retries');
        }
        logger.warning(`Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempt++;
      }
    }
  }

  /**
   * Publishes a blob to an allowlist
   * @param {string} allowlistId - The allowlist ID
   * @param {string} entryObjectId - The entry object ID
   * @param {string} blobId - The blob ID to publish
   * @returns {Promise<boolean>} Success status
   */
  async publishToAllowlist(allowlistId, entryObjectId, blobId) {
    logger.processing(`Publishing blob to allowlist`);
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::allowlist::publish`,
      arguments: [
        txb.object(allowlistId),
        txb.object(entryObjectId),
        txb.pure(blobId),
      ],
    });
    txb.setGasBudget(10000000);

    try {
      await this.client.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: { showEffects: true },
        requestType: 'WaitForLocalExecution',
      });
      logger.success(`Content published to allowlist successfully`);
      return true;
    } catch (error) {
      logger.error(`Error publishing to allowlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Publishes a blob to a subscription service
   * @param {string} sharedObjectId - The shared object ID
   * @param {string} serviceEntryId - The service entry ID
   * @param {string} blobId - The blob ID to publish
   * @returns {Promise<boolean>} Success status
   */
  async publishToSubscription(sharedObjectId, serviceEntryId, blobId) {
    logger.processing(`Publishing blob to subscription service`);
    const txb = new TransactionBlock();
    txb.moveCall({
      target: `${PACKAGE_ID}::subscription::publish`,
      arguments: [
        txb.object(sharedObjectId),
        txb.object(serviceEntryId),
        txb.pure(blobId),
      ],
    });
    txb.setGasBudget(10000000);

    try {
      await this.client.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        signer: this.keypair,
        options: { showEffects: true },
        requestType: 'WaitForLocalExecution',
      });
      logger.success(`Content published to subscription successfully`);
      return true;
    } catch (error) {
      logger.error(`Error publishing to subscription: ${error.message}`);
      throw error;
    }
  }

  /**
   * Runs the complete allowlist workflow
   * @param {string} imageSource - Image source (URL or local path)
   * @param {Array<string>} additionalAddresses - Additional addresses to add
   * @param {number} count - Number of allowlists to create
   * @returns {Promise<Array<Object>>} Results of the operations
   */
  async runAllowlistWorkflow(imageSource = DEFAULT_IMAGE_URL, additionalAddresses = [], count = 1) {
    logger.info(`Starting allowlist workflow for ${count} allowlist(s)`);
    const results = [];
    
    try {
      for (let i = 1; i <= count; i++) {
        logger.divider();
        logger.info(`Processing allowlist ${i} of ${count}`);
        
        const { allowlistId, entryObjectId } = await this.createAllowlist();
        await this.addToAllowlist(allowlistId, entryObjectId, this.getAddress());
        
        if (additionalAddresses.length > 0) {
          for (const address of additionalAddresses) {
            await this.addToAllowlist(allowlistId, entryObjectId, address);
          }
        }
        
        const blobId = await this.uploadBlob(imageSource);
        await this.publishToAllowlist(allowlistId, entryObjectId, blobId);
        
        results.push({ allowlistId, entryObjectId, blobId });
      }
      
      logger.divider();
      logger.success(`Allowlist workflow completed successfully`);
      return results;
    } catch (error) {
      logger.error(`Allowlist workflow failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Runs the complete service subscription workflow
   * @param {string} imageSource - Image source (URL or local path)
   * @param {number} count - Number of services to create
   * @returns {Promise<Array<Object>>} Results of the operations
   */
  async runServiceSubscriptionWorkflow(imageSource = DEFAULT_IMAGE_URL, count = 1) {
    logger.info(`Starting service subscription workflow for ${count} service(s)`);
    const results = [];
    
    try {
      for (let i = 1; i <= count; i++) {
        logger.divider();
        logger.info(`Processing service ${i} of ${count}`);
        
        const { sharedObjectId, serviceEntryId } = await this.addServiceEntry(10, 60000000);
        const blobId = await this.uploadBlob(imageSource);
        await this.publishToSubscription(sharedObjectId, serviceEntryId, blobId);
        
        results.push({ sharedObjectId, serviceEntryId, blobId });
      }
      
      logger.divider();
      logger.success(`Service subscription workflow completed successfully`);
      return results;
    } catch (error) {
      logger.error(`Service subscription workflow failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { SuiAllowlistBot };