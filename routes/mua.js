import express from 'express';
import MUA from '../models/MUA.js';
import User from '../models/User.js'; // Import User model for reference
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/mua - list semua MUA dengan filter (lokasi, kategori, harga)
router.get('/', async (req, res) => {
  try {
    const { location, category, minPrice, maxPrice, search } = req.query;
    
    let filter = {};

    if (location) filter.location = new RegExp(location, 'i'); // Case insensitive
    if (category) filter.category = category;
    if (minPrice) filter.minPrice = { $gte: Number(minPrice) };
    if (maxPrice) filter.maxPrice = { $lte: Number(maxPrice) };
    
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { specialty: new RegExp(search, 'i') }
      ];
    }

    const muas = await MUA.find(filter)
      .sort({ rating: -1, reviewsCount: -1 });
    
    res.json(muas);
  } catch (error) {
    console.error('Get MUA error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data MUA' });
  }
});

// GET /api/mua/:id - detail MUA
router.get('/:id', async (req, res) => {
  try {
    const mua = await MUA.findById(req.params.id);
    
    if (!mua) {
      return res.status(404).json({ message: 'MUA tidak ditemukan' });
    }

    res.json(mua);
  } catch (error) {
    console.error('Get MUA detail error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data MUA' });
  }
});

// Only authenticated users can create MUA profiles
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      name, 
      location, 
      category, 
      minPrice,
      maxPrice,
      profilePhoto, 
      portfolio, 
      specialty, 
      about, 
      experienceYears,
      experienceDescription,
      certifications 
    } = req.body;

    // Check if user already has an MUA profile
    const existingMUA = await MUA.findOne({ userId: req.user.uid });
    if (existingMUA) {
      return res.status(400).json({ message: 'User sudah memiliki profile MUA' });
    }

    const newMUA = new MUA({
      userId: req.user.uid,
      name,
      location,
      category,
      minPrice,
      maxPrice,
      profilePhoto: profilePhoto || '',
      portfolio: portfolio || [],
      specialty,
      about: about || '',
      experienceYears: experienceYears || null,
      experienceDescription: experienceDescription || '',
      certifications: certifications || []
    });

    await newMUA.save();

    res.status(201).json(newMUA);
  } catch (error) {
    console.error('Create MUA error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat membuat profile MUA' });
  }
});

export default router;