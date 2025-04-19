const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: false, // Make user optional for guest orders
    },
    cartItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: 'Product',
        },
        quantity: Number,
        color: String,
        price: Number,
      },
    ],
    taxPrice: {
      type: Number,
      default: 0,
    },
    shippingAddress: {
      type: {
        details: String,
        phone: String,
        city: String,
        email: String // Add email field for guest users (optional)
      },
      required: true,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    totalOrderPrice: {
      type: Number,
    },
    paymentMethodType: {
      type: String,
      enum: ['card', 'cash'],
      default: 'cash',
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,
  },
  { timestamps: true }
);

// Pre-hook to populate user and product fields
orderSchema.pre(/^find/, function (next) {
  // Populate user only if the user field exists (not null)
  this.populate({
    path: 'user',
    select: 'name profileImg email phone',
    // Add a condition to skip population if user is null
    match: { _id: { $ne: null } },
  }).populate({
    path: 'cartItems.product',
    select: 'title imageCover',
  });

  next();
});

module.exports = mongoose.model('Order', orderSchema);