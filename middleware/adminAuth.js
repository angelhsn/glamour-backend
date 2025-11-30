import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const adminAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if the user is an admin
    const admin = await Admin.findById(decoded.uid);
    if (!admin || !admin.isActive) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    // Check if the role is valid for admin access
    if (!["ADMIN", "SUPER_ADMIN"].includes(admin.role)) {
      return res.status(403).json({ message: "Access denied. Insufficient privileges." });
    }
    
    req.admin = admin;
    req.adminId = decoded.uid;
    req.adminRole = decoded.role;
    
    next();
  } catch (err) {
    console.error("Admin token verification error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Middleware to check for super admin role specifically
const superAdminAuth = async (req, res, next) => {
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
    req.adminRole = decoded.role;
    
    next();
  } catch (err) {
    console.error("Super admin token verification error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export { adminAuth, superAdminAuth };