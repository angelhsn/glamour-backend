import express from "express";
import jwt from "jsonwebtoken";
import Joi from "joi";
import User from "../models/user.js";

const router = express.Router();

// Middleware for JWT token verification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      message: "Access token required",
      success: false
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      // Check if token expired
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: "Token expired", 
          success: false 
        });
      }
      return res.status(403).json({ 
        message: "Invalid or expired token", 
        success: false 
      });
    }
    req.user = user;
    next();
  });
};

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().allow(""),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("CUSTOMER","MUA","ADMIN").optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

// Create JWT token for user
const signToken = (user) =>
  jwt.sign(
    { uid: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: process.env.JWT_EXPIRES || "7d",
      issuer: 'glamour-backend',
      audience: 'glamour-users'
    }
  );

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    // Validate request body
    const { value, error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        message: error.message,
        success: false 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: value.email });
    if (existingUser) {
      return res.status(409).json({ 
        message: "Email already registered",
        success: false 
      });
    }

    // Create new user
    const user = new User({
      name: value.name,
      email: value.email,
      password: value.password,
      role: value.role || 'CUSTOMER'
    });
    
    await user.save();
    
    // Generate token without password
    const token = signToken(user);
    res.status(201).json({
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
    console.error('Registration error:', err);
    next(err); 
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    // Validate request body
    const { value, error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        message: error.message,
        success: false 
      });
    }

    // Find user by email
    const user = await User.findOne({ email: value.email });
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }

    // Compare password using bcrypt
    const isPasswordValid = await user.comparePassword(value.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }

    // Generate JWT token
    const token = signToken(user);
    
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
    console.error('Login error:', err);
    next(err); 
  }
});

// Optional: GET /api/auth/me - Get current user info (for testing)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.uid).select('-password');
    if (!user) {
      return res.status(404).json({ 
        message: "User not found", 
        success: false 
      });
    }
    
    res.json({
      success: true,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ 
      message: "Server error", 
      success: false 
    });
  }
});

// Optional: Additional route that might be called by frontend at /api/login
// For compatibility with frontend that might call /api/login instead of /api/auth/login
router.post("/login-compat", async (req, res, next) => {
  try {
    // This is an alias route for compatibility
    // Same logic as the login route
    const { value, error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        message: error.message,
        success: false 
      });
    }

    const user = await User.findOne({ email: value.email });
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }

    const isPasswordValid = await user.comparePassword(value.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid credentials", 
        success: false 
      });
    }

    const token = signToken(user);
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
    console.error('Compatibility login error:', err);
    next(err); 
  }
});

export default router;
export { authenticateToken as authenticateToken };