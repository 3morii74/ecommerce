const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/apiError');
const Product = require('../models/productModel');
const Coupon = require('../models/couponModel');
const Cart = require('../models/cartModel');

const calcTotalCartPrice = (cart) => {
  let totalPrice = 0;
  cart.cartItems.forEach((item) => {
    totalPrice += item.quantity * item.price;
  });
  cart.totalCartPrice = totalPrice;
  cart.totalPriceAfterDiscount = undefined;
  return totalPrice;
};

// @desc    Add product to cart
// @route   POST /api/v1/cart
// @access  Private/User
exports.addProductToCart = asyncHandler(async (req, res, next) => {
  const { productId, color, quantity = 1 } = req.body;
  const userId = req.user._id; // Authenticated user
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError('Product not found', 404));
  }

  // Validate stock
  if (product.quantity < quantity) {
    return next(new ApiError('Insufficient stock', 400));
  }

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError('Quantity must be a positive integer', 400));
  }

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    // Create a new cart
    cart = await Cart.create({
      user: userId,
      cartItems: [{ product: productId, color, price: product.price, quantity }],
    });
  } else {
    const productIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === productId && item.color === color
    );

    if (productIndex > -1) {
      cart.cartItems[productIndex].quantity = quantity;
    } else {
      cart.cartItems.push({ product: productId, color, price: product.price, quantity });
    }
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    message: 'Product added to cart successfully',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Get user cart
// @route   GET /api/v1/cart
// @access  Private/User
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId }).populate({
    path: 'cartItems.product',
    select: 'imageCover title price', // Retain imageCover as per previous request
  });

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Remove specific cart item
// @route   DELETE /api/v1/cart/:itemId
// @access  Private/User
exports.removeSpecificCartItem = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $pull: { cartItems: { _id: req.params.itemId } } },
    { new: true }
  );

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Clear cart
// @route   DELETE /api/v1/cart
// @access  Private/User
exports.clearCart = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOneAndDelete({ user: userId });

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  res.status(204).send();
});

// @desc    Update specific cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Private/User
exports.updateCartItemQuantity = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const userId = req.user._id;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError('Quantity must be a positive integer', 400));
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );
  if (itemIndex > -1) {
    // Validate stock
    const product = await Product.findById(cart.cartItems[itemIndex].product);
    if (product.quantity < quantity) {
      return next(new ApiError('Insufficient stock', 400));
    }
    cart.cartItems[itemIndex].quantity = quantity;
  } else {
    return next(new ApiError(`Item not found: ${req.params.itemId}`, 404));
  }

  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});

// @desc    Apply coupon on cart
// @route   PUT /api/v1/cart/applyCoupon
// @access  Private/User
exports.applyCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findOne({
    name: req.body.coupon,
    expire: { $gt: Date.now() },
  });

  if (!coupon) {
    return next(new ApiError('Coupon is invalid or expired', 400));
  }

  const userId = req.user._id;

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  const totalPrice = cart.totalCartPrice;
  const totalPriceAfterDiscount = (
    totalPrice -
    (totalPrice * coupon.discount) / 100
  ).toFixed(2);

  cart.totalPriceAfterDiscount = totalPriceAfterDiscount;
  await cart.save();

  res.status(200).json({
    status: 'success',
    numOfCartItems: cart.cartItems.length,
    data: cart,
  });
});