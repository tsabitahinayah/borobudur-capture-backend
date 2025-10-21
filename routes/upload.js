const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getContainerClient } = require('../config/azure');
const Session = require('../models/Session');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'borobudur-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Upload image endpoint
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    const { photo_id } = req.body;
    
    // Validate required fields
    if (!photo_id || !req.file) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: photo_id or file' 
      });
    }

    // Ensure container client is ready
    const containerClient = await getContainerClient();

    // Get the next session ID for current photo session
    const sessionInfo = await Session.getNextSessionId();
    const session_id = sessionInfo.nextSessionId;
    const blobPath = `${session_id}/images/${photo_id}.jpg`;
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath);
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    // Upload file to Azure Blob Storage
    await blockBlobClient.upload(fileContent, fileContent.length, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' }
    });

    // Clean up temporary file
    fs.unlinkSync(filePath);

    res.status(200).json({
      status: 'success',
      photo_id,
      session_id,
      path: blobPath
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to upload image',
      error: error.message
    });
  }
});

// Upload metadata endpoint
router.post('/meta', async (req, res) => {
  try {
    const { photo_id, side_flag, bend, timestamp } = req.body;
    
    // Validate required fields
    if (!photo_id || !side_flag || !bend || !timestamp) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields in metadata' 
      });
    }

    // Ensure container client is ready
    const containerClient = await getContainerClient();

    // Get the next session ID for current photo session
    const sessionInfo = await Session.getNextSessionId();
    const session_id = sessionInfo.nextSessionId;
    const blobPath = `${session_id}/metadata/${photo_id}.json`;
    
    // Add session_id to metadata
    const metadataWithSession = { ...req.body, session_id };
    const metadataContent = JSON.stringify(metadataWithSession);
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    // Upload metadata to Azure Blob Storage
    await blockBlobClient.upload(metadataContent, metadataContent.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    res.status(200).json({
      status: 'success',
      photo_id,
      session_id,
      path: blobPath
    });
  } catch (error) {
    console.error('Error uploading metadata:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to upload metadata',
      error: error.message
    });
  }
});

module.exports = router;