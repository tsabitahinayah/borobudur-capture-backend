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

// Connect to MongoDB - will be called on each request in serverless environment
// Initialize Azure Blob Storage - will be initialized on demand
let azureInitialized = false;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Connect to MongoDB on each request (for serverless environment)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    
    // Initialize Azure on first request
    if (!azureInitialized) {
      require('./config/azure');
      azureInitialized = true;
    }
    next();
  } catch (error) {
    console.error('Error connecting to services:', error);
    res.status(500).json({ error: 'Server initialization error' });
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