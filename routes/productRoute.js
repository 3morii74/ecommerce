const express = require('express');
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
// New route to get views for a specific product
router.get('/:id/views', authService.protect // Ensure user is authenticated
  , authService.allowedTo('admin') // Restrict to admins
  , async (req, res) => {
    try {
      const product = await Product.findById(req.params.id).select('views');
      if (!product) {
        return res.status(404).json({ status: 'error', message: 'Product not found' });
      }
      res.status(200).json({ status: 'success', views: product.views });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Error fetching views', error: error.message });
    }
  });

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
