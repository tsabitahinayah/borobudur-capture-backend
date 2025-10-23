const express = require('express');
const router = express.Router();
const { getContainerClient } = require('../config/azure');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Session = require('../models/Session');

// GET current session status - for STM robot to know the last completed session
router.get('/current', async (req, res) => {
  try {
    const lastCompletedSession = await Session.getLastCompletedSession();
    
    if (!lastCompletedSession) {
      // First time - no sessions completed yet
      res.status(200).json({
        status: 'success',
        message: 'No previous sessions found - this is the first session',
        data: {
          last_completed_session: null,
          next_session_id: 'session_001',
          is_first_session: true
        }
      });
    } else {
      // Previous session exists
      const sessionInfo = await Session.getNextSessionId();
      res.status(200).json({
        status: 'success',
        message: 'Last completed session retrieved successfully',
        data: {
          last_completed_session: lastCompletedSession.sessionId,
          completed_at: lastCompletedSession.completedAt,
          next_session_id: sessionInfo.nextSessionId,
          is_first_session: false
        }
      });
    }
  } catch (error) {
    console.error('Error getting current session status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve current session status',
      error: error.message
    });
  }
});

// POST end session - create completed session record in MongoDB
router.post('/end', async (req, res) => {
  try {
    const completedSession = await Session.completeSession();
    
    res.status(200).json({
      status: 'success',
      message: 'Session completed and recorded successfully',
      data: {
        completed_session_id: completedSession.sessionId,
        completed_at: completedSession.completedAt,
        status: completedSession.status
      }
    });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to complete session',
      error: error.message
    });
  }
});

// Session status endpoint
router.get('/status/:session_id', async (req, res) => {
  try {
    const rawSessionId = req.params.session_id;
    const session_id = decodeURIComponent(String(rawSessionId)).trim();

    // Reject placeholder syntax like ":session_id" and empty values
    if (!session_id || session_id.includes(':')) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid session_id. Use the actual value, e.g., GET /session/status/session_003'
      });
    }

    const containerClient = await getContainerClient();
    
    // List all blobs in the session
    const imagePrefix = `${session_id}/images/`;
    const metadataPrefix = `${session_id}/metadata/`;
    
    const images = [];
    const metadata = [];
    
    // Collect all images
    for await (const blob of containerClient.listBlobsFlat({ prefix: imagePrefix })) {
      images.push(blob.name);
    }
    
    // Collect all metadata
    for await (const blob of containerClient.listBlobsFlat({ prefix: metadataPrefix })) {
      metadata.push(blob.name);
    }
    
    // Check for consistency (.jpg and .jpeg supported)
    const imageIds = images.map(name => path.basename(name).replace(/\.(jpg|jpeg)$/i, ''));
    const metadataIds = metadata.map(name => path.basename(name, '.json'));
    
    const missingMetadata = imageIds.filter(id => !metadataIds.includes(id));
    const missingImages = metadataIds.filter(id => !imageIds.includes(id));
    
    const isConsistent = missingMetadata.length === 0 && missingImages.length === 0;
    
    res.status(200).json({
      status: 'success',
      session_id,
      image_count: images.length,
      metadata_count: metadata.length,
      is_consistent: isConsistent,
      missing_metadata: missingMetadata,
      missing_images: missingImages
    });
  } catch (error) {
    console.error('Error checking session status:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to check session status',
      error: error.message
    });
  }
});

// Session download endpoint
router.get('/download/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const containerClient = await getContainerClient();
    
    // Create temporary directory for downloads in writable tmp
    const baseTmp = path.join(os.tmpdir(), 'borobudur-temp');
    if (!fs.existsSync(baseTmp)) {
      fs.mkdirSync(baseTmp, { recursive: true });
    }
    const tempDir = path.join(baseTmp, session_id);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create subdirectories
    const imagesDir = path.join(tempDir, 'images');
    const metadataDir = path.join(tempDir, 'metadata');
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    // List all blobs in the session
    const imagePrefix = `${session_id}/images/`;
    const metadataPrefix = `${session_id}/metadata/`;
    
    // Download all images
    for await (const blob of containerClient.listBlobsFlat({ prefix: imagePrefix })) {
      const fileName = path.basename(blob.name);
      const filePath = path.join(imagesDir, fileName);
      
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      await blockBlobClient.downloadToFile(filePath);
    }
    
    // Download all metadata
    for await (const blob of containerClient.listBlobsFlat({ prefix: metadataPrefix })) {
      const fileName = path.basename(blob.name);
      const filePath = path.join(metadataDir, fileName);
      
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      await blockBlobClient.downloadToFile(filePath);
    }
    
    // Create zip file
    const zipPath = path.join(baseTmp, `${session_id}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Pipe archive to output file
    archive.pipe(output);
    
    // Add files to archive
    archive.directory(tempDir, session_id);
    
    // Finalize archive
    await archive.finalize();
    
    // Wait for output stream to finish
    await new Promise((resolve) => {
      output.on('close', resolve);
    });
    
    // Send zip file
    res.download(zipPath, `${session_id}.zip`, (err) => {
      if (err) {
        console.error('Error sending zip file:', err);
      }
      
      // Clean up temporary files
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
    });
  } catch (error) {
    console.error('Error downloading session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to download session',
      error: error.message
    });
  }
});

module.exports = router;