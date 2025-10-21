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

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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