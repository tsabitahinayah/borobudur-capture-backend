const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/mongodb');
const uploadRoutes = require('./routes/upload');
const sessionRoutes = require('./routes/session');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Connect to MongoDB only for routes that need it (serverless-friendly)
app.use(async (req, res, next) => {
  try {
    // Only connect for routes that interact with DB/Azure
    if (req.path.startsWith('/upload') || req.path.startsWith('/session')) {
      // Check if MongoDB URI is defined
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not defined');
      }
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Error connecting to services:', error);
    // Provide more specific error message without leaking secrets
    const errorMessage = error.message.includes('MONGODB_URI') 
      ? 'Missing database configuration. Please check environment variables.'
      : 'Server initialization error. Database connection failed.';
    
    res.status(500).json({ 
      error: errorMessage,
      code: 'DB_CONNECTION_ERROR'
    });
  }
});

// Routes
app.use('/upload', uploadRoutes);
app.use('/session', sessionRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Borobudur Capture API',
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    env: process.env.NODE_ENV,
    services: {
      mongodb: { status: 'unknown' },
      azure: { status: 'unknown' }
    }
  };

  try {
    // Check MongoDB connection without requiring it
    if (process.env.MONGODB_URI) {
      try {
        await connectDB();
        health.services.mongodb.status = 'connected';
      } catch (error) {
        health.services.mongodb.status = 'error';
        health.services.mongodb.message = error.message.includes('MONGODB_URI') 
          ? 'Missing configuration' 
          : 'Connection failed';
      }
    } else {
      health.services.mongodb.status = 'not_configured';
    }

    // Check Azure connection without requiring it
    const azureConnString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AZURE_CONNECTION_STRING;
    const azureContainer = process.env.AZURE_STORAGE_CONTAINER_NAME || process.env.AZURE_CONTAINER_NAME;
    
    if (azureConnString && azureContainer) {
      try {
        const { getContainerClient } = require('./config/azure');
        await getContainerClient();
        health.services.azure.status = 'connected';
      } catch (error) {
        health.services.azure.status = 'error';
        health.services.azure.message = 'Connection failed';
      }
    } else {
      health.services.azure.status = 'not_configured';
      health.services.azure.missing = !azureConnString ? 'connection_string' : 'container_name';
    }

    // Determine overall health status
    const isHealthy = health.services.mongodb.status === 'connected' && 
                      health.services.azure.status === 'connected';
    
    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    health.status = 'error';
    health.error = error.message;
    res.status(500).json(health);
  }
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Catch-all error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, don't exit the process
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Export for Vercel serverless deployment
module.exports = app;