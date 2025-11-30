import mongoose from 'mongoose';

const muaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  reviewsCount: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['Bridal & Traditional', 'Fashion & Editorial', 'Bridal & Photoshoot', 'Party & Events', 'Natural & Daily', 'Bridal & Luxury']
  },
  minPrice: {
    type: Number,
    required: true
  },
  maxPrice: {
    type: Number,
    required: true
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  portfolio: {
    type: [String],
    default: []
  },
  specialty: {
    type: String,
    required: true
  },
  availability: {
    type: String,
    enum: ['Available', 'Booked', 'Unavailable'],
    default: 'Available'
  },
  about: {
    type: String
  },
  experienceYears: {
    type: Number
  },
  experienceDescription: {
    type: String
  },
  certifications: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

const MUA = mongoose.model('MUA', muaSchema);

export default MUA;