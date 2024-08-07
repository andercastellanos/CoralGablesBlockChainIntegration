require('dotenv').config();// loads enviroment variables from the .env file to process .env.
const express = require('express'); // Imports Express framework, used to create the server.
const cors = require('cors'); // imports the CORS middleware to handle Cross-Origin resource sharing. 
const { Web3 } = require('web3'); // Imports the Web3 library to interact with ethereum blockchain.(as of now)
const { OpenSeaSDK, Chain } = require('opensea-js');// Imports the OpenSea SDK for Interacting with Opensea API and Chain Enumeration

const app = express(); // Create an instance of an Express application.
app.use(express.json()); // Configures the Express app to parse incoming JSON Request
app.use(cors()); // Configures Express app to use CORS middleware.

// Configuration
const privateKey = process.env.PRIVATE_KEY; // Gets private key from environment variables.
const accountAddress = process.env.ACCOUNT_ADDRESS; // Gets account address from environment variables.
const networkRPC = process.env.NETWORK_RPC; // Gets network RPC URL from environment variables. Rpc URL interacts with avalanche 
const contractAddress = process.env.CONTRACT_ADDRESS; // Gets the contract address from environment variables.
console.log('Environment variables loaded');
console.log('Network RPC:', networkRPC);
const web3 = new Web3(networkRPC);
// End of configuration 


// Initialize Web3 with RPC URL 
const openseaSDK = new OpenSeaSDK(web3.currentProvider, {
    chain: Chain.Avalanche,
    apiKey: process.env.OPENSEA_API_KEY
});
console.log('OpenSea SDK initialized')
// Make sure SDK initialized 


// To  interact with the blockchain you need an authenticated account. Used to Sign Transactions
// Create account from private key to make this interaction
let account;
try {
    const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    console.log('Private key length:', formattedPrivateKey.length);
    
    account = web3.eth.accounts.privateKeyToAccount(formattedPrivateKey);
    console.log('Account created:', account.address);
    
    // Clear the wallet and add the account
    web3.eth.accounts.wallet.clear();
    const wallet = web3.eth.accounts.wallet.add(account);
    console.log('Wallet accounts:', wallet.length);
    console.log('Wallet contains account:', wallet.get(account.address) !== undefined);
    
    // Set the default account
    web3.eth.defaultAccount = account.address;
    console.log('Default account set:', web3.eth.defaultAccount);
    
    // Verify the account balance
    web3.eth.getBalance(account.address).then(balance => {
        console.log('Account balance:', web3.utils.fromWei(balance, 'ether'), 'AVAX');
    });
} catch (error) {
    console.error('Error creating account:', error);
    process.exit(1);
} // End Account


// Check Balance Function 
const checkBalance = async () => {
    const balance = await web3.eth.getBalance(account.address);
    console.log(`Account balance: ${web3.utils.fromWei(balance, 'ether')} AVAX`);
    if (web3.utils.fromWei(balance, 'ether') < 0.1) {
      console.warn('Warning: Account balance is low. Transactions may fail.');
    }
  }; // end check balance function 



  checkBalance();



// Approval function
const approveNFT = async (tokenAddress, operatorAddress) => {
    try {
        console.log('Approving ERC1155 tokens:');
        console.log('Token Address:', tokenAddress);
        console.log('Operator:', operatorAddress);

        const ERC1155_ABI = [
            {
                "inputs": [
                    {"internalType": "address", "name": "operator", "type": "address"},
                    {"internalType": "bool", "name": "approved", "type": "bool"}
                ],
                "name": "setApprovalForAll",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "account", "type": "address"},
                    {"internalType": "address", "name": "operator", "type": "address"}
                ],
                "name": "isApprovedForAll",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        const contract = new web3.eth.Contract(ERC1155_ABI, tokenAddress);

        // Check current approval
        const isCurrentlyApproved = await contract.methods.isApprovedForAll(account.address, operatorAddress).call();
        console.log('Currently approved:', isCurrentlyApproved);

        if (isCurrentlyApproved) {
            console.log('Operator already approved for all tokens');
            return null; // No need to approve again
        }

        // Proceed with approval
        const gasPrice = await web3.eth.getGasPrice();
        console.log('Current gas price:', gasPrice);

        const gasEstimate = await contract.methods.setApprovalForAll(operatorAddress, true).estimateGas({from: account.address});
        console.log('Estimated gas for approval:', gasEstimate);

        const tx = await contract.methods.setApprovalForAll(operatorAddress, true).send({
            from: account.address,
            gas: gasEstimate,
            gasPrice: gasPrice
        });

        console.log('Approval Transaction Hash:', tx.transactionHash);
        return tx.transactionHash;
    } catch (error) {
        console.error('Approval error details:', error);
        throw new Error("Approval failed: " + error.message);
    }
};// End Approval Function



// TransferNFT function
const transferNFT = async (operatorAddress, tokenAddress, tokenId, amount) => {
    try {
        const fromAddress = process.env.ACCOUNT_ADDRESS; // Get the address from .env

        console.log('Transferring ERC1155 NFT:');
        console.log('From:', fromAddress);
        console.log('To (Operator):', operatorAddress);
        console.log('Token Address:', tokenAddress);
        console.log('Token ID:', tokenId);
        console.log('Amount:', amount);

        const ERC1155_ABI = [
            {
                "inputs": [
                    {"internalType": "address", "name": "from", "type": "address"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "id", "type": "uint256"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "bytes", "name": "data", "type": "bytes"}
                ],
                "name": "safeTransferFrom",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];

        const contract = new web3.eth.Contract(ERC1155_ABI, tokenAddress);

        const gasPrice = await web3.eth.getGasPrice();
        const gasEstimate = await contract.methods.safeTransferFrom(fromAddress, operatorAddress, tokenId, amount, '0x').estimateGas({from: fromAddress});

        const tx = await contract.methods.safeTransferFrom(fromAddress, operatorAddress, tokenId, amount, '0x').send({
            from: fromAddress,
            gas: gasEstimate,
            gasPrice: gasPrice
        });

        console.log('Transaction Hash:', tx.transactionHash);
        return tx.transactionHash;
    } catch (error) {
        console.error('Transfer error details:', error);
        throw new Error("Transfer failed: " + error.message);
    }
};// end 



// Middle ware to log incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} request to ${req.url}`);
    next();
});

// endpoint for the APROVE  
app.post('/approve', async (req, res) => {
    const { tokenAddress, operatorAddress } = req.body;
    
    if (!tokenAddress || !operatorAddress) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
        const approvalHash = await approveNFT(tokenAddress, operatorAddress);
        res.status(200).json({ approvalHash });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({
            error: error.message,
            details: error.toString()
        });
    }
});// End APROVE  endpoint api 

// This TRANSFER endpoint 
app.post('/transfer', async (req, res) => {
    const { operatorAddress, tokenAddress, tokenId, amount } = req.body;
    
    if (!operatorAddress || !tokenAddress || !tokenId || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
        const transferHash = await transferNFT(operatorAddress, tokenAddress, tokenId, amount);
        res.status(200).json({ transferHash });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({
            error: error.message,
            details: error.toString()
        });
    }
});// END TRANSFER 


// This the handles the reservation for the NFTs
app.post('/reserveNFT', async (req, res) => {
    const { tokenId, userAddress } = req.body;
    console.log('Reserve NFT request body:', req.body);

    if (!tokenId || !userAddress) {
        return res.status(400).json({ error: 'Missing tokenId or userAddress' });
    }

    try {
        const reservation = await reserveNFT(tokenId, userAddress);
        res.status(200).json({ message: 'NFT reserved successfully', reservation });
    } catch (error) {
        console.error('Error reserving NFT:', error);
        res.status(500).json({ error: error.message });
    }
});




app.get('/', (req, res) => {
    res.send('Server is running successfully.');
});

app.options('*', cors());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});





