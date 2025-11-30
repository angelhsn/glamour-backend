import express from "express";
import jwt from "jsonwebtoken";
import Joi from "joi";
import Admin from "../models/admin.js";
import User from "../models/user.js";
import MUA from "../models/mua.js";
import Booking from "../models/booking.js";
import Review from "../models/review.js";
import LoginLog from "../models/loginLog.js";

const router = express.Router();

// Create JWT token for admin
const signToken = (admin) =>
  jwt.sign({ uid: admin._id, role: admin.role }, process.env.JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRES || "7d" 
  });

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.uid);
    if (!admin || !admin.isActive) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    
    req.admin = admin;
    req.adminId = decoded.uid;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Super admin authentication middleware
const superAdminAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.uid);
    if (!admin || !admin.isActive || admin.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Super admin privileges required" });
    }
    
    req.admin = admin;
    req.adminId = decoded.uid;
    next();
  } catch (err) {
    console.error("Super admin token verification error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Admin Registration (only for super admin or first admin)
router.post("/register", async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid("ADMIN", "SUPER_ADMIN").optional().default("ADMIN")
    });

    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // Check if admin already exists with this email
    const adminExists = await Admin.findOne({ email: value.email });
    if (adminExists) return res.status(409).json({ message: "Email already registered" });

    // Check if any admin exists - if not, allow creating the first super admin
    const adminCount = await Admin.countDocuments();
    const hasExistingAdmins = adminCount > 0;
    
    if (hasExistingAdmins) {
      // If there are existing admins, require super admin auth
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({ message: "Access token required" });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if the user is a super admin
        const admin = await Admin.findById(decoded.uid);
        if (!admin || !admin.isActive) {
          return res.status(403).json({ message: "Access denied. Admin privileges required." });
        }
        
        if (admin.role !== "SUPER_ADMIN") {
          return res.status(403).json({ message: "Access denied. Super admin privileges required." });
        }
        
        req.admin = admin;
        req.adminId = decoded.uid;
      } catch (err) {
        console.error("Super admin token verification error:", err);
        return res.status(403).json({ message: "Invalid or expired token" });
      }
    } else {
      // First admin can be created without token, but must be SUPER_ADMIN
      value.role = "SUPER_ADMIN"; // Force first admin to be super admin
    }

    const admin = new Admin({
      name: value.name,
      email: value.email,
      password: value.password,
      role: value.role
    });

    await admin.save();
    const token = signToken(admin);
    
    res.status(201).json({
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) { 
    next(err); 
  }
});

// Admin login
router.post("/login", async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    });

    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const admin = await Admin.findOne({ email: value.email, isActive: true });
    if (!admin) {
      // Log failed login attempt
      await LoginLog.create({
        adminId: null,
        email: value.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        failureReason: 'Invalid credentials'
      }).catch(err => console.error('LoginLog error:', err));
      
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await admin.comparePassword(value.password);
    if (!ok) {
      // Log failed login attempt
      await LoginLog.create({
        adminId: admin._id,
        email: value.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        failureReason: 'Invalid password'
      }).catch(err => console.error('LoginLog error:', err));
      
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Log successful login
    await LoginLog.create({
      adminId: admin._id,
      email: value.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    }).catch(err => console.error('LoginLog error:', err));

    const token = signToken(admin);
    res.json({
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) { 
    console.error('Login error:', err);
    next(err); 
  }
});

// Get dashboard stats
router.get("/dashboard-stats", adminAuth, async (req, res, next) => {
  try {
    const [
      userCount,
      muaCount,
      bookingCount,
      reviewCount
    ] = await Promise.all([
      User.countDocuments(),
      MUA.countDocuments(),
      Booking.countDocuments(),
      Review.countDocuments()
    ]);

    // Count pending bookings
    const pendingBookingCount = await Booking.countDocuments({ status: "pending" });

    res.json({
      totalUsers: userCount,
      totalMUAs: muaCount,
      totalBookings: bookingCount,
      totalReviews: reviewCount,
      pendingBookings: pendingBookingCount
    });
  } catch (err) { 
    next(err); 
  }
});

// Get user list with pagination
router.get("/users", adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const users = await User.find({}, { password: 0 }) // Exclude password
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments();
    
    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get single user
router.get("/users/:id", adminAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id, { password: 0 }); // Exclude password
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) { 
    next(err); 
  }
});

// Update user
router.put("/users/:id", adminAuth, async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'email', 'role'];
    
    // Filter out any properties not in the allowed list
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = value;
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    
    res.json(updatedUser);
  } catch (err) { 
    next(err); 
  }
});

// Delete user
router.delete("/users/:id", adminAuth, async (req, res, next) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) { 
    next(err); 
  }
});

// Get MUA list with pagination
router.get("/muas", adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const muas = await MUA.find({})
      .populate('userId', 'name email') // Populate user info
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await MUA.countDocuments();
    
    res.json({
      muas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get single MUA
router.get("/muas/:id", adminAuth, async (req, res, next) => {
  try {
    const mua = await MUA.findById(req.params.id)
      .populate('userId', 'name email');
    if (!mua) return res.status(404).json({ message: "MUA not found" });
    res.json(mua);
  } catch (err) { 
    next(err); 
  }
});

// Update MUA
router.put("/muas/:id", adminAuth, async (req, res, next) => {
  try {
    const allowedUpdates = [
      'name', 'location', 'category', 'minPrice', 'maxPrice', 'profilePhoto', 
      'portfolio', 'specialty', 'availability', 'about', 'experienceYears', 
      'experienceDescription', 'certifications'
    ];
    
    // Filter out any properties not in the allowed list
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = value;
      }
    }
    
    const updatedMua = await MUA.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedMua) return res.status(404).json({ message: "MUA not found" });
    
    res.json(updatedMua);
  } catch (err) { 
    next(err); 
  }
});

// Delete MUA
router.delete("/muas/:id", adminAuth, async (req, res, next) => {
  try {
    const deletedMua = await MUA.findByIdAndDelete(req.params.id);
    if (!deletedMua) return res.status(404).json({ message: "MUA not found" });
    res.json({ message: "MUA deleted successfully" });
  } catch (err) { 
    next(err); 
  }
});

// Get booking list with pagination
router.get("/bookings", adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find({})
      .populate('userId', 'name email')
      .populate('muaId', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Booking.countDocuments();
    
    res.json({
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get single booking
router.get("/bookings/:id", adminAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('muaId', 'name profilePhoto');
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (err) { 
    next(err); 
  }
});

// Update booking
router.put("/bookings/:id", adminAuth, async (req, res, next) => {
  try {
    const allowedUpdates = [
      'status', 'location', 'notes', 'totalAmount', 'paymentStatus'
    ];
    
    // Filter out any properties not in the allowed list
    const updates = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = value;
      }
    }
    
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedBooking) return res.status(404).json({ message: "Booking not found" });
    
    res.json(updatedBooking);
  } catch (err) { 
    next(err); 
  }
});

// Delete booking
router.delete("/bookings/:id", adminAuth, async (req, res, next) => {
  try {
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) return res.status(404).json({ message: "Booking not found" });
    res.json({ message: "Booking deleted successfully" });
  } catch (err) { 
    next(err); 
  }
});

// Get review list with pagination
router.get("/reviews", adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const reviews = await Review.find({})
      .populate('userId', 'name email')
      .populate('muaId', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Review.countDocuments();
    
    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Update review (e.g., approve/disapprove)
router.put("/reviews/:id", adminAuth, async (req, res, next) => {
  try {
    const schema = Joi.object({
      isApproved: Joi.boolean()
    });

    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    );

    if (!updatedReview) return res.status(404).json({ message: "Review not found" });
    
    res.json(updatedReview);
  } catch (err) { 
    next(err); 
  }
});

// Delete review
router.delete("/reviews/:id", adminAuth, async (req, res, next) => {
  try {
    const deletedReview = await Review.findByIdAndDelete(req.params.id);
    if (!deletedReview) return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review deleted successfully" });
  } catch (err) { 
    next(err); 
  }
});

// Get login logs with pagination
router.get("/login-logs", adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let filter = {};
    if (req.query.email) {
      filter.email = new RegExp(req.query.email, 'i'); // Case insensitive search
    }
    if (req.query.success !== undefined) {
      filter.success = req.query.success === 'true';
    }
    
    const logs = await LoginLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await LoginLog.countDocuments(filter);
    
    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { 
    next(err); 
  }
});

// Get admin profile
router.get("/profile", adminAuth, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.adminId, { password: 0 }); // Exclude password
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json(admin);
  } catch (err) { 
    next(err); 
  }
});

// Update admin profile
router.put("/profile", adminAuth, async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().allow(""),
      email: Joi.string().email(),
    });

    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.adminId,
      value,
      { new: true, runValidators: true }
    );

    if (!updatedAdmin) return res.status(404).json({ message: "Admin not found" });
    
    res.json(updatedAdmin);
  } catch (err) { 
    next(err); 
  }
});

export default router;