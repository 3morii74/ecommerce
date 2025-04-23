const express = require('express');

const {
  getCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
} = require('../services/couponService');

const authService = require('../services/authService');

const router = express.Router();

router.use(authService.protect, authService.allowedTo('admin', 'manager'));

router.route('/').get(getCoupons).post(createCoupon);
router.route('/:id').get(getCoupon).put(updateCoupon).delete(deleteCoupon);

router.route('/status').post(applyCoupon);

module.exports = router;
