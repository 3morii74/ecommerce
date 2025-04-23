const express = require('express');

const rateLimit = require('express-rate-limit');
const {
  addProductToCart,
  getLoggedUserCart,
  removeSpecificCartItem,
  clearCart,
  updateCartItemQuantity,
  applyCoupon,
} = require('../services/cartService');
const authService = require('../services/authService');

const router = express.Router();

// Rate limiting for cart actions (100 requests per 15 minutes)
const cartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many cart requests, please try again later.',
});

// Apply rate limiting and authentication to all routes
router.use(cartLimiter, authService.protect, authService.allowedTo('user'));

router
  .route('/')
  .post(addProductToCart)
  .get(getLoggedUserCart)
  .delete(clearCart);

// router.put('/applyCoupon', applyCoupon);

router
  .route('/:itemId')
  .put(updateCartItemQuantity)
  .delete(removeSpecificCartItem);

module.exports = router;