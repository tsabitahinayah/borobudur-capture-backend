const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/mongodb');
const uploadRoutes = require('./routes/upload');
const sessionRoutes = require('./routes/session');
const errorHandler = require('./middleware/errorHandler');
require('./config/azure'); // Initialize Azure Blob Storage

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});