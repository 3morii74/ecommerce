const express = require('express');
const mongoose = require('mongoose');

const asyncHandler = require('express-async-handler');

const Product = require('../models/productModel'); const {
  getProductValidator,
  createProductValidator,
  updateProductValidator,
  deleteProductValidator,
} = require('../utils/validators/productValidator');

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  resizeProductImages,
} = require('../services/productService');
const authService = require('../services/authService');
const reviewsRoute = require('./reviewRoute');

const router = express.Router();

// POST   /products/jkshjhsdjh2332n/reviews
// GET    /products/jkshjhsdjh2332n/reviews
// GET    /products/jkshjhsdjh2332n/reviews/87487sfww3
router.use('/:productId/reviews', reviewsRoute);

router
  .route('/')
  .get(getProducts)
  .post(
    authService.protect,
    authService.allowedTo('admin', 'manager'),
    uploadProductImages,

    resizeProductImages,
    createProductValidator,
    createProduct
  );
// New route to get daily views for a specific product
router.get(
  '/:id/views',
  authService.protect, // Ensure user is authenticated
  authService.allowedTo('admin'), // Restrict to admins
  asyncHandler(async (req, res) => {
    const productId = req.params.id;

    // Validate product ID
    if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product ID' });
    }

    // Optional date range query parameters
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date('1970-01-01'); // Default to epoch start
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(); // Default to today

    // Validate dates
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Invalid date format' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ status: 'error', message: 'startDate cannot be after endDate' });
    }

    // Set endDate to end of day
    endDate.setHours(23, 59, 59, 999);

    // Aggregate views by day
    const dailyViews = await Product.aggregate([
      // Match the product
      { $match: { _id: new mongoose.Types.ObjectId(productId) } },
      // Unwind viewedBy array
      { $unwind: '$viewedBy' },
      // Filter by date range
      {
        $match: {
          'viewedBy.timestamp': {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      // Group by day
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$viewedBy.timestamp' },
          },
          uniqueIPs: { $addToSet: '$viewedBy.ipAddress' }, // Collect unique IPs per day
        },
      },
      // Calculate views (count of unique IPs)
      {
        $project: {
          date: '$_id',
          views: { $size: '$uniqueIPs' },
          _id: 0,
        },
      },
      // Sort by date descending
      { $sort: { date: -1 } },
    ]);

    // Check if product exists
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    // If no views in the date range, return empty array
    res.status(200).json({
      status: 'success',
      data: dailyViews,
    });
  })
);

// New route to get total views for all products
router.get('/views', authService.protect, authService.allowedTo('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find()
      .select('title views')
      .sort({ views: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!products || products.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No products found' });
    }

    const productViews = products.map(product => ({
      id: product._id,
      title: product.title,
      views: product.views,
    }));

    res.status(200).json({
      status: 'success',
      data: productViews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching product views',
      error: error.message,
    });
  }
});
router
  .route('/:id')
  .get(getProductValidator, getProduct)
  .put(
    authService.protect,
    authService.allowedTo('admin', 'manager'),
    uploadProductImages,
    resizeProductImages,
    updateProductValidator,
    updateProduct
  )
  .delete(
    authService.protect,
    authService.allowedTo('admin'),
    deleteProductValidator,
    deleteProduct
  );

module.exports = router;
