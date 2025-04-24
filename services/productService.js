const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const requestIp = require('request-ip'); // Install via npm: npm install request-ip

const { uploadMixOfImages } = require('../middlewares/uploadImageMiddleware');
const factory = require('./handlersFactory');
const Product = require('../models/productModel');

exports.uploadProductImages = uploadMixOfImages([
  {
    name: 'imageCover',
    maxCount: 1,
  },
  {
    name: 'images',
    maxCount: 5,
  },
]);

exports.resizeProductImages = asyncHandler(async (req, res, next) => {
  // Check if req.files exists and has content before processing
  if (req.files && Object.keys(req.files).length > 0) {
    // 1- Image processing for imageCover (if provided)
    if (req.files.imageCover && req.files.imageCover.length > 0) {
      const imageCoverFileName = `product-${uuidv4()}-${Date.now()}-cover.jpeg`;

      await sharp(req.files.imageCover[0].buffer)
        .resize(442, 422)
        .toFormat('jpeg')
        .jpeg({ quality: 95 })
        .toFile(`uploads/products/${imageCoverFileName}`);

      // Save image into our db
      req.body.imageCover = imageCoverFileName;
    }

    // 2- Image processing for images (if provided)
    if (req.files.images && req.files.images.length > 0) {
      req.body.images = [];
      await Promise.all(
        req.files.images.map(async (img, index) => {
          const imageName = `product-${uuidv4()}-${Date.now()}-${index + 1}.jpeg`;

          await sharp(img.buffer)
            .resize(2000, 1333)
            .toFormat('jpeg')
            .jpeg({ quality: 95 })
            .toFile(`uploads/products/${imageName}`);

          // Save image into our db
          req.body.images.push(imageName);
        })
      );
    }
  }

  // Always call next() whether files were processed or not
  next();
});

// @desc    Get list of products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = factory.getAll(Product, 'Products');

// @desc    Get specific product by id
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const clientIp = requestIp.getClientIp(req); // Extract client's IP address

    // Find the product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    // Check if this IP has already viewed the product
    const hasViewed = product.viewedBy.some(view => view.ipAddress === clientIp);

    if (!hasViewed) {
      // Increment views and add IP to viewedBy
      product.views += 1;
      product.viewedBy.push({ ipAddress: clientIp });
      await product.save();
    }

    // Populate reviews and return the product
    const populatedProduct = await Product.findById(productId).populate('reviews');
    res.status(200).json({ status: 'success', data: populatedProduct });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching product', error: error.message });
  }
};
// @desc    Create product
// @route   POST  /api/v1/products
// @access  Private
exports.createProduct = factory.createOne(Product);
// @desc    Update specific product
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = factory.updateOne(Product);

// @desc    Delete specific product
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = factory.deleteOne(Product);
