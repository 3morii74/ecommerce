const express = require('express');
const {
  createCashOrder,
  findAllOrders,
  findSpecificOrder,
  filterOrderForLoggedUser,
  updateOrderToPaid,
  updateOrderToDelivered,
  checkoutSession,
} = require('../services/orderService');
const authService = require('../services/authService');

const router = express.Router();

// Public route: Allow unauthenticated users to create a cash order
router.route('/:cartId').post(createCashOrder);

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
  filterOrderForLoggedUser,
  findAllOrders
);

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

module.exports = router;