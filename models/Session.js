const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  completedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Static method to get last completed session
sessionSchema.statics.getLastCompletedSession = async function() {
  try {
    // Find the most recent completed session
    const lastSession = await this.findOne().sort({ completedAt: -1 });
    
    if (!lastSession) {
      // No sessions exist yet - this is the first time
      return null;
    }
    
    return lastSession;
  } catch (error) {
    throw new Error('Error retrieving last completed session: ' + error.message);
  }
};

// Static method to create completed session record
sessionSchema.statics.completeSession = async function() {
  try {
    const lastSession = await this.getLastCompletedSession();
    
    let nextSessionNumber = 1;
    if (lastSession) {
      // Extract number from session ID (e.g., "session_003" -> 3)
      const currentNumber = parseInt(lastSession.sessionId.split('_')[1]);
      nextSessionNumber = currentNumber + 1;
    }
    
    // Format new session ID with leading zeros (e.g., "session_001", "session_004")
    const newSessionId = `session_${nextSessionNumber.toString().padStart(3, '0')}`;
    
    // Create new completed session record
    const newSession = new this({
      sessionId: newSessionId,
      completedAt: new Date(),
      status: 'completed'
    });
    
    await newSession.save();
    
    return newSession;
  } catch (error) {
    throw new Error('Error completing session: ' + error.message);
  }
};

// Static method to get next session ID for current photo session
sessionSchema.statics.getNextSessionId = async function() {
  try {
    const lastSession = await this.getLastCompletedSession();
    
    let nextSessionNumber = 1;
    if (lastSession) {
      // Extract number from session ID (e.g., "session_003" -> 3)
      const currentNumber = parseInt(lastSession.sessionId.split('_')[1]);
      nextSessionNumber = currentNumber + 1;
    }
    
    // Format next session ID with leading zeros (e.g., "session_001", "session_004")
    const nextSessionId = `session_${nextSessionNumber.toString().padStart(3, '0')}`;
    
    return {
      lastCompletedSession: lastSession ? lastSession.sessionId : null,
      nextSessionId: nextSessionId,
      isFirstSession: !lastSession
    };
  } catch (error) {
    throw new Error('Error getting next session ID: ' + error.message);
  }
};

module.exports = mongoose.model('Session', sessionSchema);