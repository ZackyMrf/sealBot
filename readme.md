# SUI Seal Blockchain Tool

A modular automation tool for SUI blockchain operations that simplifies complex tasks like allowlist management, service subscription handling, and publishing blobs to the blockchain. With features such as multi-wallet support, proxy integration, and daily automation, the tool is designed to improve efficiency and scalability.

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
    - [Daily Scheduling](#daily-scheduling)
5. [Project Structure](#project-structure)
6. [Common Issues](#common-issues)
7. [License](#license)

---

## Features

### 🔒 Allowlist Management
- Create new allowlist entries.
- Add addresses to allowlists.
- Publish content blobs to allowlists.

### 🔄 Service Subscription Management
- Create service entries with custom amounts and durations.
- Publish content blobs to subscription services.

### 💳 Multi-Wallet Support
- Use single or multiple wallets.
- Process tasks in sequence for each wallet.
- Run daily operations across all configured wallets.

### 🌐 Proxy Integration
- Support for HTTP/HTTPS proxies.
- Automatic proxy rotation for better performance.

### 🖼️ Image Management
- Use URLs for image sources.
- Use local images from disk.
- Generate random images from free APIs.

### ⚙️ Automation
- Schedule daily runs at specified times.
- Configure retry behavior for failed operations.
- Run headless with default configurations.

---

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/zackymrf/sealBot.git
cd sealBot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Your Environment
- **Single Wallet**: Create a `private_key.txt` file with your private key, if private key does not work, use pharse / mnemonic .
- **Multiple Wallets**: Add your wallet keys/ pharse  to `wallets.txt`, one per line.
- **Optional**: Create a `proxies.txt` file with proxy configurations.

---

## Configuration

### 🔑 Wallet Configuration
- **Single Wallet**: Add your SUI private key or mnemonic to a file named `private_key.txt` in the project root.
- **Multiple Wallets**: Add each wallet's private key or mnemonic to `wallets.txt`, one per line.

### 🌐 Proxy Configuration
Add your proxies to a file named `proxies.txt`, with one proxy per line in any of the following formats:
- `host:port`
- `host:port:username:password`
- `username:password@host:port`


## Usage

### ▶️ Manual Execution
Run the tool interactively:
```bash
npm start
```

### 🛠️ Available Actions
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

### 🖼️ Image Sources
1. **Use URL**: Provide a direct URL to an image or use the default random image.
2. **Use Local File**: Place an `image.jpg` file in the project root directory.
3. **Generate Random Image**: Automatically fetch a random image from various free services.

### 🕒 Daily Scheduling
Run the tool on a scheduled basis:
```bash
npm run schedule
```

This will start a scheduler that runs the bot daily at the configured time (default: 10:00 AM). The scheduler will:

1. Load all wallets from `wallets.txt`.
2. Execute both allowlist and subscription tasks for each wallet.
3. Use random images by default.
4. Retry failed operations automatically.

To configure the scheduler, create or edit the `schedule-config.json` file:
```json
{
  "schedule": "0 10 * * *",  // Cron expression: run at 10:00 AM daily
  "maxRetries": 3,            // Number of retry attempts for failed tasks
  "retryDelay": 300000        // Delay between retries (5 minutes)
}
```

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
├── scheduler.js           # Daily automation scheduler
├── private_key.txt        # Single wallet key (not in repo)
├── wallets.txt            # Multiple wallet keys (not in repo)
└── proxies.txt            # Proxy configurations (not in repo)
```

---

## Common Issues

### ❗ Module Not Found Errors
Ensure all dependencies are installed by running:
```bash
npm install
```

### ❌ Invalid Private Key
Check the format of your private key in `private_key.txt` or `wallets.txt`. The tool supports multiple formats:
- Mnemonic phrases (12 or 24 words)
- Hex private keys (with or without 0x prefix)
- Base64 encoded private keys
- SUI private key format (`suiprivkey...`)

### 📡 Connection Errors
Verify your internet connection and proxy settings if applicable. If using proxies, ensure they're correctly formatted in `proxies.txt`.

### 🖼️ Missing Image File
If using the local image option, ensure `image.jpg` exists in the project root directory.

### ⏰ Scheduler Not Running
If the scheduler isn't working correctly:
1. Check your system's time settings.
2. Verify the cron expression in `schedule-config.json`.
3. Check the logs for any error messages.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.