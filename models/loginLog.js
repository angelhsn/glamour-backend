import mongoose from 'mongoose';

const loginLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  email: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  success: {
    type: Boolean,
    default: true
  },
  failureReason: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  },
  region: {
    type: String
  }
}, {
  timestamps: true
});

const LoginLog = mongoose.model('LoginLog', loginLogSchema);

export default LoginLog;