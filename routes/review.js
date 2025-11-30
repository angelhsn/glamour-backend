import express from 'express';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import MUA from '../models/MUA.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// POST /api/review - submit review setelah booking selesai
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking tidak ditemukan' });
    }

    if (booking.userId.toString() !== req.user.uid) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Hanya booking yang selesai bisa direview' });
    }

    // Check if user already reviewed this booking
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(400).json({ message: 'Booking ini sudah direview' });
    }

    const newReview = new Review({
      userId: req.user.uid,
      muaId: booking.muaId,
      bookingId,
      rating,
      comment
    });

    await newReview.save();

    // Update MUA rating and reviews count
    const reviews = await Review.find({ muaId: booking.muaId });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / reviews.length;
    
    await MUA.findByIdAndUpdate(
      booking.muaId,
      {
        rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        reviewsCount: reviews.length
      }
    );

    res.status(201).json(newReview);
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat submit review' });
  }
});

export default router;