const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Too short product title'],
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },

    sold: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      trim: true,
    },
    priceAfterDiscount: {
      type: Number,
    },
    colors: [String],
    imageCover: {
      type: String,
      required: [true, 'Product Image cover is required'],
    },
    images: [String],
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'Product must be belong to category'],
    },
    brand: {
      type: mongoose.Schema.ObjectId,
      ref: 'Brand',
    },
    ratingsAverage: {
      type: Number,
      min: [1, 'Rating must be above or equal 1.0'],
      max: [5, 'Rating must be below or equal 5.0'],
    },
    views: {
      type: Number,
      default: 0, // Total unique views
    },
    viewedBy: [
      {
        ipAddress: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
productSchema.index({ views: -1 });
//productSchema.index({ 'viewedBy.timestamp': 1 }); // Index for efficient sorting/grouping
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id',
});

// Populate category for find and findOne
productSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'name _id', // Include _id and name
  });
  next();
});

const setImageURL = (doc) => {
  console.log('setImageURL called for doc:', doc._id, 'imageCover:', doc.imageCover);
  const isUrl = (str) => /^https?:\/\//i.test(str);

  if (doc.imageCover && !isUrl(doc.imageCover)) {
    const imageUrl = `${process.env.BASE_URL}/products/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
  if (doc.images) {
    const imagesList = [];
    doc.images.forEach((image) => {
      const imageUrl = isUrl(image) ? image : `${process.env.BASE_URL}/products/${image}`;
      imagesList.push(imageUrl);
    });
    doc.images = imagesList;
  }
};

// Apply setImageURL for find and findOne
// findOne, findAll and update
productSchema.post('init', (doc) => {
  setImageURL(doc);
});

// Create only
productSchema.post('save', (doc) => {
  if (doc.isNew) {
    console.log('post save triggered for create:', doc._id);
    setImageURL(doc);
  }
});

module.exports = mongoose.model('Product', productSchema);