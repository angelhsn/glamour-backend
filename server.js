// ==========================
//  Glamour Makeup Backend (MongoDB)
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

// Middleware
const corsOptions = {
  origin: [
    "http://localhost:5173", // Default Vite development server
    "http://localhost:3000", // Common React development server
    "http://localhost:8080", // Your frontend development server
    process.env.FRONTEND_URL, // Allow environment variable to override
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Explicitly allow these methods
  allowedHeaders: ["Content-Type", "Authorization"] // Explicitly allow these headers
};
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/glamour';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/mua", muaRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server berjalan normal" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("ERR:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));