const asyncHandler = require('express-async-handler');

const factory = require('./handlersFactory');
const Coupon = require('../models/couponModel');
const ApiError = require('../utils/apiError');

// @desc    Get list of coupons
// @route   GET /api/v1/coupons
// @access  Private/Admin-Manager
exports.getCoupons = factory.getAll(Coupon);

// @desc    Get specific coupon by id
// @route   GET /api/v1/coupons/:id
// @access  Private/Admin-Manager
exports.getCoupon = factory.getOne(Coupon);

// @desc    Create coupon
// @route   POST  /api/v1/coupons
// @access  Private/Admin-Manager
exports.createCoupon = factory.createOne(Coupon);

// @desc    Update specific coupon
// @route   PUT /api/v1/coupons/:id
// @access  Private/Admin-Manager
exports.updateCoupon = factory.updateOne(Coupon);

// @desc    Delete specific coupon
// @route   DELETE /api/v1/coupons/:id
// @access  Private/Admin-Manager
exports.deleteCoupon = factory.deleteOne(Coupon);

exports.applyCoupon = asyncHandler(async (req, res, next) => {
    const coupon = await Coupon.findOne({
        name: req.body.coupon,
        expire: { $gt: Date.now() },
    });

    if (!coupon) {
        return next(new ApiError('Coupon is invalid or expired', 400));
    }
    const discount = coupon.discount;

    res.status(200).json({
        status: 'success',
        discount: discount
    });
});