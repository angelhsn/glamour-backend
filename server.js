// ==========================
//  Glamour Makeup Backend (Production Ready)
// ==========================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/booking.js";
import muaRoutes from "./routes/mua.js";
import reviewRoutes from "./routes/review.js";
import paymentRoutes from "./routes/payment.js";
import adminRoutes from "./routes/admin.js";

const app = express();

// CORS Configuration - Updated to include Railway URL and handle production environment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:5173", // Vite development server
      "http://localhost:3000", // Common React development server
      "http://localhost:8080",
      "https://glamour-frontend-production.up.railway.app", // Production frontend
      "https://glamour-backend-production.up.railway.app",  // Production backend
      process.env.FRONTEND_URL, // Environment variable for frontend
    ].filter(Boolean); // Remove any undefined values

    const isAllowed = allowedOrigins.includes(origin) || 
                     origin?.includes('localhost') || 
                     origin?.includes('railway.app');
    
    callback(null, isAllowed);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI 
      || "mongodb+srv://firdausiangel7_db_user:Glamour2025db@cluster0.hnaosra.mongodb.net/glamour?retryWrites=true&w=majority&tls=true";

    await mongoose.connect(mongoURI, {
      ssl: true,
      tlsAllowInvalidCertificates: false,
      serverSelectionTimeoutMS: 15000, // Increased timeout for production
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep default timeout
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

connectDB();

// Default route - As requested
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Backend is running", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Direct API routes for compatibility (in case frontend calls /api/login instead of /api/auth/login)
// This addresses the route mismatch issue
app.post("/api/login", async (req, res) => {
  // Import User model and JWT functionality for direct auth
  const { email, password } = req.body;
  
  // Validate inputs
  if (!email || !password) {
    return res.status(400).json({ 
      message: "Email and password are required",
      success: false 
    });
  }
  
  try {
    // Import User model
    const { default: User } = await import('./models/user.js');
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }
    
    // Compare password using bcrypt
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }
    
    // Create JWT token
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { uid: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: process.env.JWT_EXPIRES || "7d",
        issuer: 'glamour-backend',
        audience: 'glamour-users'
      }
    );
    
    // Send successful response
    res.json({
      success: true,
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (err) {
    console.error('Direct login error:', err);
    res.status(500).json({ 
      message: "Internal Server Error", 
      success: false 
    });
  }
});

// Routes with proper API structure
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/mua", muaRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "Server berjalan normal",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Additional endpoints as requested (for GET requests to existing POST endpoints)
// This provides fallback GET endpoints for testing purposes
app.get('/api/auth/login', (req, res) => {
  res.status(405).json({ 
    message: "Use POST /api/auth/login for authentication",
    available: ["POST /api/auth/login", "POST /api/auth/register"]
  });
});

app.get('/api/login', (req, res) => {
  res.status(405).json({ 
    message: "Use POST /api/login or POST /api/auth/login for authentication",
    available: ["POST /api/login", "POST /api/auth/login", "POST /api/auth/register"]
  });
});

app.get('/api/register', (req, res) => {
  res.status(405).json({ 
    message: "Use POST /api/auth/register for user registration",
    available: ["POST /api/auth/register", "POST /api/auth/login"]
  });
});

app.get('/api/payment/create', (req, res) => {
  res.status(405).json({ 
    message: "Use POST /api/payment/create to create payment transaction",
    available: ["POST /api/payment/create"]
  });
});

app.get('/api/admin', (req, res) => {
  res.status(405).json({ 
    message: "Use POST /api/admin/login or POST /api/admin/register for admin operations",
    available: [
      "POST /api/admin/login", 
      "POST /api/admin/register", 
      "GET /api/admin/profile (requires auth)",
      "GET /api/admin/users (requires auth)"
    ]
  });
});

// 404 handler - Return JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({ 
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    availableRoutes: [
      "GET /",
      "GET /api/health", 
      "POST /api/auth/register", 
      "POST /api/auth/login", 
      "POST /api/login (compatibility)",
      "POST /api/payment/create",
      "POST /api/admin/login",
      "POST /api/admin/register"
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  
  // Prevent sending headers if already sent
  if (res.headersSent) {
    return next(err);
  }
  
  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Send error response
  res.status(statusCode).json({ 
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) // Don't send stack trace in production
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application will exit here
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔐 Base URL: https://glamour-backend-production.up.railway.app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;