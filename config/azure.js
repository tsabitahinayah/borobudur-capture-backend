const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');

dotenv.config();

// Lazy-initialized Azure Blob Storage clients
let blobServiceClient = null;
let containerClient = null;
let containerInitialized = false;

// Get (and initialize) the container client on demand
const getContainerClient = async () => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_CONTAINER_NAME;

  if (!connectionString) {
    throw new Error('Azure connection string is not set (AZURE_STORAGE_CONNECTION_STRING or AZURE_CONNECTION_STRING)');
  }
  if (!containerName) {
    throw new Error('Azure container name is not set (AZURE_STORAGE_CONTAINER_NAME or AZURE_CONTAINER_NAME)');
  }

  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }

  if (!containerClient) {
    containerClient = blobServiceClient.getContainerClient(containerName);
  }

  if (!containerInitialized) {
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      await containerClient.create();
      console.log(`Container '${containerName}' created successfully`);
    } else {
      console.log(`Container '${containerName}' already exists`);
    }
    containerInitialized = true;
  }

  return containerClient;
};

// Explicit initializer (optional): ensures the container is ready
const initializeContainer = async () => {
  await getContainerClient();
};

module.exports = {
  getContainerClient,
  initializeContainer
};