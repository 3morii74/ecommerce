const express = require('express');
const {
  createCashOrder,
  findAllOrders,
  findSpecificOrder,
  updateOrderToPaid,
  updateOrderToDelivered,
  checkoutSession,
  softDeleteOrder,
  findDeletedOrders,
} = require('../services/orderService');
const authService = require('../services/authService');

const router = express.Router();

// Allow authenticated and unauthenticated users (public route)
router.route('/').post(createCashOrder);

// Protected routes: Require authentication
router.get(
  '/checkout-session/:cartId',
  authService.protect,
  authService.allowedTo('user'),
  checkoutSession
);

router.get(
  '/',
  authService.protect,
  authService.allowedTo('user', 'admin', 'manager'),
  findAllOrders
);

// Get all soft-deleted orders: Admin only (moved before /:id)
router.get(
  '/deleted',
  authService.protect,
  authService.allowedTo('admin'),
  findDeletedOrders
);

// Get specific order: Must come after /deleted to avoid conflict
router.get(
  '/:id',
  authService.protect,
  authService.allowedTo('user', 'admin', 'manager'),
  findSpecificOrder
);

router.put(
  '/:id/pay',
  authService.protect,
  authService.allowedTo('admin', 'manager'),
  updateOrderToPaid
);

router.put(
  '/:id/deliver',
  authService.protect,
  authService.allowedTo('admin', 'manager'),
  updateOrderToDelivered
);

// Soft delete route: Admin only
router.delete(
  '/:id/soft-delete',
  authService.protect,
  authService.allowedTo('admin'),
  softDeleteOrder
);

module.exports = router;