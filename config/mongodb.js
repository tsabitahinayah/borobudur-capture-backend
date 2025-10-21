const mongoose = require('mongoose');

// Track connection status
let isConnected = false;

// MongoDB connection configuration
const connectDB = async () => {
  // If already connected, return the existing connection
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return;
  }

  // Validate MongoDB URI
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit process in serverless environment
    isConnected = false;
    throw error;
  }
};

module.exports = connectDB;