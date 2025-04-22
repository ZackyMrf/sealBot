# SUI Seal Blockchain Tool

A modular automation tool for SUI blockchain operations, including allowlist management and service subscription handling. This tool simplifies complex tasks such as creating allowlists, managing service subscriptions, and publishing blobs to the blockchain.

![SUI Seal Banner](https://picsum.photos/800/200)

---

## Table of Contents
1. [Features](#features)
2. [Installation](#installation)
3. [Configuration](#configuration)
    - [Wallet Configuration](#wallet-configuration)
    - [Proxy Configuration](#proxy-configuration)
    - [Environment Variables](#environment-variables)
4. [Usage](#usage)
    - [Available Actions](#available-actions)
    - [Image Sources](#image-sources)
5. [Project Structure](#project-structure)
6. [Common Issues](#common-issues)
7. [License](#license)

---

## Features

### Allowlist Management
- Create new allowlist entries.
- Add addresses to allowlists.
- Publish content blobs to allowlists.

### Service Subscription Management
- Create service entries with custom amounts and durations.
- Publish content blobs to subscription services.

### Multi-Wallet Support
- Use single or multiple wallets.
- Process tasks in sequence for each wallet.

### Proxy Integration
- Support for HTTP/HTTPS proxies.
- Automatic proxy rotation.

### Image Management
- Use URLs for image sources.
- Use local images from disk.
- Generate random images from free APIs.

---

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/zackymrf/sealBot.git
cd sealBot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure your environment
- **Single Wallet**: Create a `private_key.txt` file with your private key.
- **Optional**: Create a `proxies.txt` file with proxy configurations.

---

## Configuration

### Wallet Configuration
- **Single Wallet**: Add your SUI private key or mnemonic to a file named `private_key.txt` in the project root.
- **Multiple Wallets**: Add each wallet's private key or mnemonic to `wallets.txt`, one per line.

### Proxy Configuration
Add your proxies to a file named `proxies.txt`, with one proxy per line in any of the following formats:
- `host:port`
- `host:port:username:password`
- `username:password@host:port`

### Environment Variables
Create a `.env` file in the project root and add the following:
```
SUI_RPC_URL=https://fullnode.devnet.sui.io:443
```

---

## Usage

Run the tool with:
```bash
npm start
```

### Available Actions
1. **Create Allowlist and Publish Blob**
   - Create a new allowlist entry.
   - Add your wallet address to the allowlist.
   - Upload an image as a blob.
   - Publish the blob to the allowlist.

2. **Create Service Subscription and Upload Blob**
   - Create a new service subscription.
   - Upload an image as a blob.
   - Publish the blob to the subscription service.

3. **Run Both Tasks Simultaneously**
   - Perform both tasks in sequence.

### Image Sources
1. **Use URL**: Provide a direct URL to an image or use the default random image.
2. **Use Local File**: Place an `image.jpg` file in the project root directory.
3. **Generate Random Image**: Automatically fetch a random image from various free services.

---

## Project Structure

```
sui-seal-blockchain-tool/
├── config/
│   └── constants.js       # Configuration constants
├── services/
│   └── logger.js          # Logging service
├── utils/
│   ├── promptUtil.js      # User input utilities
│   ├── proxyManager.js    # Proxy handling
│   ├── suiBot.js          # SUI blockchain interactions
│   └── walletManager.js   # Wallet management       
├── .gitignore             # Git ignore rules
├── index.js               # Main application entry point
├── package.json           # Project dependencies
├── private_key.txt        # Single wallet key (not in repo)
├── wallets.txt            # Multiple wallet keys (not in repo)
└── proxies.txt            # Proxy configurations (not in repo)
```

---

## Common Issues

### Module Not Found Errors
Ensure all dependencies are installed by running:
```bash
npm install
```

### Invalid Private Key
Check the format of your private key in `private_key.txt` or `wallets.txt`.

### Connection Errors
Verify your internet connection and proxy settings if applicable.

### Missing Image File
If using the local image option, ensure `image.jpg` exists in the project root directory.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.