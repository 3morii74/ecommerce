const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    cartItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
        },
        color: String,
        price: Number,
      },
    ],
    totalCartPrice: Number,
    totalPriceAfterDiscount: Number,
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: false, // Optional for guest carts
    },
    clientIp: {
      type: String,
      required: false, // Only set for guest carts
    },
  },
  { timestamps: true }
);

// Add indexes for better query performance
cartSchema.index({ user: 1 }, { sparse: true });
cartSchema.index({ clientIp: 1 }, { sparse: true }); // Index for guest carts

module.exports = mongoose.model('Cart', cartSchema);