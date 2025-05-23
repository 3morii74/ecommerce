const mongoose = require('mongoose');

// Custom function to generate a 6-character alphanumeric ID
const generateOrderId = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: [true, 'Order ID is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: false,
    },
    cartItems: [
      {
        product: {
          type: mongoose.Schema.ObjectId,
          ref: 'Product',
        },
        quantity: Number,
        price: Number,
        name: String,
      },
    ],
    shippingAddress: {
      type: {
        alias: { type: String, required: [true, 'Alias is required'] },
        details: { type: String, required: [true, 'Details is required'] },
        phone: { type: String, required: [true, 'Phone is required'] },
        city: { type: String, required: [true, 'City is required'] },
        postalCode: { type: String, required: false },
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
      default: false,
    },
    deletedAt: Date,
  },
  { timestamps: true, id: false }
);

// Pre-validate hook to generate a unique orderId
orderSchema.pre('validate', async function (next) {
  console.log('Pre-validate hook: Checking orderId...');
  if (this.isNew && !this.orderId) {
    console.log('Generating new orderId...');
    let isUnique = false;
    let id;
    let retries = 0;
    const maxRetries = 5;

    try {
      while (!isUnique && retries < maxRetries) {
        id = generateOrderId();
        console.log(`Attempt ${retries + 1}: Generated orderId: ${id}`);
        const existingOrder = await mongoose.models.Order.findOne({ orderId: id });
        if (!existingOrder) {
          isUnique = true;
          console.log(`Unique orderId found: ${id}`);
        } else {
          console.log(`Collision detected for orderId: ${id}`);
        }
        retries++;
      }

      if (!isUnique) {
        console.error('Failed to generate unique orderId after maximum retries');
        return next(new Error('Failed to generate a unique orderId after maximum retries'));
      }

      this.orderId = id;
      console.log(`Assigned orderId: ${this.orderId}`);
    } catch (error) {
      console.error('Error in pre-validate hook:', error);
      return next(error);
    }
  } else {
    console.log('orderId already exists or not a new document:', this.orderId);
  }
  next();
});

// Pre-hook to exclude soft-deleted orders by default
orderSchema.pre(/^find/, function (next) {
  console.log('Pre-find hook - Query:', this.getQuery());
  console.log('Pre-find hook - IncludeDeleted:', this.getQuery().includeDeleted);

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