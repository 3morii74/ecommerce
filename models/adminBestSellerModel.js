const mongoose = require('mongoose');

const adminBestSellerSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assumes an existing User model
    required: true,
  },
  addedDate: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

adminBestSellerSchema.index({ isActive: 1, addedDate: -1 });

// Transform productId.image into productId.imageUrl after population
adminBestSellerSchema.post('init', (doc) => {
  if (doc.productId && doc.productId.image) {
    doc.productId.imageUrl = `${process.env.BASE_URL}/products/${doc.productId.image}`;
    delete doc.productId.image; // Remove the original image field
  }
});

module.exports = mongoose.model('AdminBestSeller', adminBestSellerSchema);