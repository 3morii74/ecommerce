const express = require('express');
const {
  addProductToCart,
  getLoggedUserCart,
  removeSpecificCartItem,
  clearCart,
  updateCartItemQuantity,
  applyCoupon,
  mergeGuestCart,
} = require('../services/cartService');
const authService = require('../services/authService');

const router = express.Router();

// Public routes: No authentication required
router
  .route('/')
  .post(addProductToCart)
  .get(getLoggedUserCart)
  .delete(clearCart);

router.put('/applyCoupon', applyCoupon);

router
  .route('/:itemId')
  .put(updateCartItemQuantity)
  .delete(removeSpecificCartItem);

// Protected route: Requires authentication
router.post(
  '/mergeGuestCart',
  authService.protect,
  authService.allowedTo('user'),
  mergeGuestCart
);

module.exports = router;