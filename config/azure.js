const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Azure Blob Storage client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

// Create the BlobServiceClient
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Initialize container if it doesn't exist
const initializeContainer = async () => {
  try {
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      await containerClient.create();
      console.log(`Container '${containerName}' created successfully`);
    } else {
      console.log(`Container '${containerName}' already exists`);
    }
  } catch (err) {
    console.error('Error initializing container:', err);
  }
};

// Initialize container when this module is imported
initializeContainer();

module.exports = {
  blobServiceClient,
  containerClient
};