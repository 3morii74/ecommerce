const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const requestIp = require('request-ip');

const { uploadMixOfImages } = require('../middlewares/uploadImageMiddleware');
const factory = require('./handlersFactory');
const Product = require('../models/productModel');

// Upload middleware for product images
exports.uploadProductImages = uploadMixOfImages([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

// Resize product images middleware
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
          req.body.images.push(imageName);
        })
      );
    }
  }
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
    const clientIp = requestIp.getClientIp(req);
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    const hasViewed = product.viewedBy.some(view => view.ipAddress === clientIp);
    if (!hasViewed) {
      product.views += 1;
      product.viewedBy.push({ ipAddress: clientIp });
      await product.save();
    }

    const populatedProduct = await Product.findById(productId).populate('reviews');
    res.status(200).json({ status: 'success', data: populatedProduct });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error fetching product', error: error.message });
  }
};

// @desc    Create product
// @route   POST /api/v1/products
// @access  Private
exports.createProduct = factory.createOne(Product);

// @desc    Update specific product
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const productId = req.params.id;
  const updateData = { ...req.body };

  // Handle imageCover: Keep URL if provided, use filename if uploaded
  if (req.body.imageCover) {
    if (req.body.imageCover.startsWith('http')) {
      // Provided as a URL, keep it as is
      updateData.imageCover = req.body.imageCover;
    }
    // If it's a filename from upload, leave it as is for setImageURL to handle
  }

  // Handle images: Keep URLs if provided, use filenames if uploaded
  if (req.body.images) {
    updateData.images = req.body.images.map(image => {
      if (image.startsWith('http')) {
        // Provided as a URL, keep it as is
        return image;
      }
      // Filename from upload, leave it as is for setImageURL to handle
      return image;
    });
  }

  // Update the product in the database
  const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, {
    new: true, // Return the updated document
    runValidators: true, // Ensure schema validation
  });

  if (!updatedProduct) {
    return res.status(404).json({ status: 'error', message: `No product found with id ${productId}` });
  }

  res.status(200).json({ status: 'success', data: updatedProduct });
});

// @desc    Delete specific product
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = factory.deleteOne(Product);