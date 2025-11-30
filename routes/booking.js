import express from 'express';
import Booking from '../models/booking.js';
import MUA from '../models/mua.js'; // Using MUA model instead of User for MUA profiles
import { authenticateToken } from './auth.js';

const router = express.Router();

// POST /api/booking - create booking baru
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { muaId, serviceName, bookingDate, bookingTime, location, notes, totalAmount } = req.body;

    // Validate required fields
    if (!muaId || !serviceName || !bookingDate || !bookingTime || !location || !totalAmount) {
      return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    // Check if MUA exists
    const muaExists = await MUA.findById(muaId);
    if (!muaExists) {
      return res.status(404).json({ message: 'MUA tidak ditemukan' });
    }

    const newBooking = new Booking({
      userId: req.user.uid,
      muaId,
      serviceName,
      bookingDate,
      bookingTime,
      location,
      notes: notes || '',
      totalAmount,
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    await newBooking.save();

    res.status(201).json({
      message: 'Booking berhasil dibuat',
      booking: newBooking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat membuat booking' });
  }
});

// GET /api/booking/user/:userId - booking history user
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    // Check if the requested user is the authenticated user or an admin
    if (req.user.uid !== req.params.userId) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const bookings = await Booking.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data booking' });
  }
});

// GET /api/booking/mua/:muaId - booking history for MUA (protected to MUA only)
router.get('/mua/:muaId', authenticateToken, async (req, res) => {
  try {
    const { muaId } = req.params;
    
    // Check if authenticated user is the MUA
    const muaProfile = await MUA.findOne({ userId: req.user.uid });
    if (!muaProfile || muaProfile._id.toString() !== muaId) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    const bookings = await Booking.find({ muaId })
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Get MUA bookings error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data booking' });
  }
});

// GET /api/booking/:id - get specific booking (user or MUA)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking tidak ditemukan' });
    }

    // Check if user is authorized to view this booking (user or assigned MUA)
    const muaProfile = await MUA.findOne({ userId: req.user.uid });
    const isMUA = muaProfile && muaProfile._id.toString() === booking.muaId.toString();
    const isUser = booking.userId.toString() === req.user.uid;

    if (!isUser && !isMUA) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data booking' });
  }
});

// PATCH /api/booking/:id - update status booking
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking tidak ditemukan' });
    }

    // Check if user is authorized to update this booking (user or assigned MUA)
    const muaProfile = await MUA.findOne({ userId: req.user.uid });
    const isMUA = muaProfile && muaProfile._id.toString() === booking.muaId.toString();
    const isUser = booking.userId.toString() === req.user.uid;

    if (!isMUA && !isUser) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    // Only MUA can change status of booking, except users can cancel pending bookings
    if (isUser && status === 'cancelled' && booking.status === 'pending') {
      // User can cancel pending booking
    } else if (isMUA && ['confirmed', 'rejected', 'completed', 'cancelled'].includes(status)) {
      // MUA can update status
    } else if (!isMUA) {
      return res.status(403).json({ message: 'Hanya MUA yang dapat mengubah status booking' });
    }

    // Update booking status
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true } // Return updated document
    );

    if (updatedBooking) {
      res.json({
        message: 'Booking berhasil diperbarui',
        booking: updatedBooking
      });
    } else {
      res.status(404).json({ message: 'Booking tidak ditemukan' });
    }
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui booking' });
  }
});

export default router;