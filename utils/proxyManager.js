const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { logger } = require('../services/logger');


class ProxyManager {
  /**
   * Creates a new ProxyManager instance
   * @param {string} proxyFilePath - Path to the file containing proxy configurations
   */
  constructor(proxyFilePath) {
    this.proxyFilePath = proxyFilePath;
    this.proxies = [];
    this.currentProxyIndex = 0;
    this.loadProxies();
  }

  /**
   * Loads proxies from the specified file
   */
  loadProxies() {
    try {
      if (fs.existsSync(this.proxyFilePath)) {
        const proxyData = fs.readFileSync(this.proxyFilePath, 'utf8');
        this.proxies = proxyData
          .split('\n')
          .map(proxy => proxy.trim())
          .filter(proxy => proxy && !proxy.startsWith('#'));
        
        if (this.proxies.length > 0) {
          logger.success(`Loaded ${this.proxies.length} proxies from ${this.proxyFilePath}`);
        } else {
          logger.warning('No proxies found in the proxy file. Will proceed without proxies.');
        }
      } else {
        logger.warning(`Proxy file ${this.proxyFilePath} not found. Will proceed without proxies.`);
      }
    } catch (error) {
      logger.error(`Error loading proxies: ${error.message}`);
    }
  }

  /**
   * Gets the next proxy in rotation
   * @returns {Object|null} Formatted proxy object or null if no proxies available
   */
  getNextProxy() {
    if (this.proxies.length === 0) return null;
    
    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return this.formatProxy(proxy);
  }

  /**
   * Formats a proxy string into a structured object
   * @param {string} proxyString - Raw proxy string (various formats supported)
   * @returns {Object|null} Formatted proxy object or null if invalid
   */
  formatProxy(proxyString) {
    if (!proxyString) return null;
    
    if (proxyString.includes('@')) {
      const [auth, hostPort] = proxyString.split('@');
      const [username, password] = auth.split(':');
      const [host, port] = hostPort.split(':');
      return {
        host,
        port,
        auth: { username, password }
      };
    }
    
    if (proxyString.split(':').length === 4) {
      const [host, port, username, password] = proxyString.split(':');
      return {
        host,
        port,
        auth: { username, password }
      };
    }
    
    if (proxyString.split(':').length === 2) {
      const [host, port] = proxyString.split(':');
      return { host, port };
    }
    
    return null;
  }

  /**
   * Creates an HTTPS proxy agent for use with HTTP clients
   * @returns {HttpsProxyAgent|null} Proxy agent or null if no proxies available
   */
  createProxyAgent() {
    const proxy = this.getNextProxy();
    if (!proxy) return null;
    
    let proxyUrl = `http://${proxy.host}:${proxy.port}`;
    
    if (proxy.auth && proxy.auth.username && proxy.auth.password) {
      proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
    }
    
    logger.network(`Using proxy: ${proxy.host}:${proxy.port}`);
    return new HttpsProxyAgent(proxyUrl);
  }
}

module.exports = { ProxyManager };
