```markdown
# SUI Seal Blockchain Tool

A modular automation tool for SUI blockchain operations including allowlist management and service subscription handling. This tool simplifies the process of creating allowlists, adding addresses, publishing blobs, and managing service subscriptions.

![SUI Seal Banner](https://picsum.photos/800/200)

## Features

- **Allowlist Management**
  - Create new allowlist entries
  - Add addresses to allowlists
  - Publish content blobs to allowlists

- **Service Subscription Management**
  - Create service entries with custom amounts and durations
  - Publish content blobs to subscription services

- **Multi-Wallet Support**
  - Use single or multiple wallets
  - Process tasks in sequence for each wallet

- **Proxy Integration**
  - Support for HTTP/HTTPS proxies
  - Automatic proxy rotation

- **Image Management**
  - Use URLs for image sources
  - Use local images from disk
  - Generate random images from free APIs

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zackymrf/sealAuto.git
   cd sealAuto
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your environment**
   - Create a `private_key.txt` file with your private key
   - Optional: Create a `proxies.txt` file with proxy configurations
 

## Configuration

### Wallet Configuration

- **Single Wallet**: Create a file named `private_key.txt` in the project root with your SUI private key or mnemonic.


### Proxy Configuration

Create a file named `proxies.txt` with one proxy per line in any of the following formats:
- `host:port`
- `host:port:username:password`
- `username:password@host:port`

### Environment Variables

```
SUI_RPC_URL=https://fullnode.devnet.sui.io:443
```

## Usage

Run the tool with:
```bash
npm start
```

### Available Actions:

1. **Create Allowlist and Publish Blob**
   - Creates a new allowlist entry
   - Adds your wallet address to the allowlist
   - Uploads an image as a blob
   - Publishes the blob to the allowlist

2. **Create Service Subscription and Upload Blob**
   - Creates a new service subscription
   - Uploads an image as a blob
   - Publishes the blob to the service

3. **Run Both Tasks Simultaneously**
   - Performs both tasks above in sequence

### Image Sources:

1. **Use URL**: Provide a direct URL to an image or use the default random image
2. **Use Local File**: Place an image.jpg file in the project root directory
3. **Generate Random Image**: Automatically fetch a random image from various free services

## Project Structure

```
sui-seal-blockchain-tool/
├── config/
│   └── constanst.js       # Configuration constants
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
├── private_key.txt                 # Single wallet key (not in repo)
├── wallets.txt            # Multiple wallet keys (not in repo)
└── proxies.txt            # Proxy configurations (not in repo)
```

## Common Issues

- **Module not found errors**: Ensure all dependencies are installed with `npm install`
- **Invalid private key**: Check the format of your private key in pk.txt or wallets.txt
- **Connection errors**: Verify your internet connection and proxy settings if applicable
- **Missing image.jpg**: If using local image option, make sure image.jpg exists in project root

## License

This project is licensed under the MIT License - see the LICENSE file for details.

