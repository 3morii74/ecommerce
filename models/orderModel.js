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
        price: Number,
      },
    ],
    shippingAddress: {
      type: {
        details: { type: String, required: true },
        apartment: { type: String, required: false },
        floor: { type: String, required: false },
        street: { type: String, required: false },
        city: { type: String, required: true },
        phone: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String, required: false },
      },
      required: true,
    },
    totalBeforeDiscount: {
      type: Number,
    },
    totalAfterDiscount: {
      type: Number,
    },
    coupon: {
      type: mongoose.Schema.ObjectId,
      ref: 'Coupon',
      required: false,
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
    deleted: {
      type: Boolean,
      default: false, // Add deleted field for soft deletion
    },
    deletedAt: Date, // Optional: Track when the order was soft-deleted
  },
  { timestamps: true }
);

// Pre-hook to exclude soft-deleted orders by default
orderSchema.pre(/^find/, function (next) {
  // Debug: Log the query and options
  console.log('Pre-find hook - Query:', this.getQuery());
  console.log('Pre-find hook - IncludeDeleted:', this.getQuery().includeDeleted);

  // Only apply the filter if 'includeDeleted' is not explicitly set to true
  if (!this.getQuery().includeDeleted) {
    console.log('Applying default filter: excluding deleted orders');
    this.where({ deleted: { $ne: true } });
  } else {
    console.log('Including deleted orders due to includeDeleted=true');
  }

  this.populate({
    path: 'user',
    select: 'name profileImg email phone',
    match: { _id: { $ne: null } },
  })
    .populate({
      path: 'cartItems.product',
      select: 'title imageCover',
    })
    .populate({
      path: 'coupon',
      select: 'code discount',
    });

  next();
});

module.exports = mongoose.model('Order', orderSchema);