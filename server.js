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

// CORS Configuration - Simplified for deployment
app.use(cors({
  origin: [
    "https://glamour-frontend-azure.vercel.app",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI
      || "mongodb+srv://firdausiangel7_db_user:Glamour2025db@cluster0.hnaosra.mongodb.net/glamour?retryWrites=true&w=majority";

    await mongoose.connect(mongoURI);

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

// Routes with proper API structure - explicitly register all routes
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

// Error responses for when users try to use GET instead of POST for auth routes
app.get('/api/auth/login', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/auth/login for authentication",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/auth/login", "POST /api/auth/register"]
  });
});

app.get('/api/auth/register', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/auth/register for user registration",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/auth/register", "POST /api/auth/login"]
  });
});

app.get('/api/login', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/login or POST /api/auth/login for authentication",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/login", "POST /api/auth/login", "POST /api/auth/register"]
  });
});

app.get('/api/register', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/auth/register for user registration",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/auth/register", "POST /api/auth/login"]
  });
});

app.get('/api/payment/create', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/payment/create to create payment transaction",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/payment/create"]
  });
});

app.get('/api/admin', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/admin/login or POST /api/admin/register for admin operations",
    method_used: req.method,
    correct_method: "POST",
    available: [
      "POST /api/admin/login",
      "POST /api/admin/register",
      "GET /api/admin/profile (requires auth)",
      "GET /api/admin/users (requires auth)"
    ]
  });
});

// Add specific method not allowed for other admin routes
app.get('/api/admin/login', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/admin/login for admin authentication",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/admin/login", "POST /api/admin/register"]
  });
});

app.get('/api/admin/register', (req, res) => {
  res.status(405).json({
    message: "Method Not Allowed. Use POST /api/admin/register for admin registration",
    method_used: req.method,
    correct_method: "POST",
    available: ["POST /api/admin/login", "POST /api/admin/register"]
  });
});

// 404 handler - Return JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`
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