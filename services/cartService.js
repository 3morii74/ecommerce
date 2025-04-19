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
// @access  Public
exports.addProductToCart = asyncHandler(async (req, res, next) => {
  const { productId, color, quantity = 1 } = req.body; // Default quantity to 1 if not provided
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError('Product not found', 404));
  }

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError('Quantity must be a positive integer', 400));
  }

  // 1) Determine user or cart identifier
  const userId = req.user ? req.user._id : null;
  let cartId = req.body.cartId || req.query.cartId; // Client sends cartId for guests
  const clientIp = req.ip || req.connection.remoteAddress; // Get client IP address

  // 2) Get or create cart
  let cart;
  if (userId) {
    // For authenticated users, use userId
    cart = await Cart.findOne({ user: userId });
  } else if (cartId) {
    // For guests with a cartId, use cartId
    cart = await Cart.findOne({ _id: cartId, user: null });
  } else {
    // For guests without a cartId, use clientIp
    cart = await Cart.findOne({ clientIp, user: null });
  }

  if (!cart) {
    // Create a new cart
    cart = await Cart.create({
      user: userId, // Will be null for guests
      clientIp: userId ? undefined : clientIp, // Store clientIp for guests
      cartItems: [{ product: productId, color, price: product.price, quantity }],
    });
    cartId = cart._id; // Set cartId for guests
  } else {
    // Product exists in cart, update quantity
    const productIndex = cart.cartItems.findIndex(
      (item) => item.product.toString() === productId && item.color === color
    );

    if (productIndex > -1) {
      const cartItem = cart.cartItems[productIndex];
      cartItem.quantity = quantity; // Update to the provided quantity
      cart.cartItems[productIndex] = cartItem;
    } else {
      // Product not in cart, add it with the specified quantity
      cart.cartItems.push({ product: productId, color, price: product.price, quantity });
    }
  }

  // 3) Calculate total cart price
  calcTotalCartPrice(cart);
  await cart.save();

  res.status(200).json({
    status: 'success',
    message: 'Product added to cart successfully',
    numOfCartItems: cart.cartItems.length,
    cartId: cartId || cart._id, // Return cartId for guests to use in future requests
    data: cart,
  });
});

// @desc    Get user or guest cart
// @route   GET /api/v1/cart
// @access  Public
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  const userId = req.user ? req.user._id : null;
  const cartId = req.query.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  let cart;
  if (userId) {
    cart = await Cart.findOne({ user: userId }).populate({
      path: 'cartItems.product',
      select: 'imageCover title price', // Include imageCover, title, and price
    });
  } else if (cartId) {
    cart = await Cart.findOne({ _id: cartId, user: null }).populate({
      path: 'cartItems.product',
      select: 'imageCover title price', // Include imageCover, title, and price
    });
  } else {
    cart = await Cart.findOne({ clientIp, user: null }).populate({
      path: 'cartItems.product',
      select: 'imageCover title price', // Include imageCover, title, and price
    });
  }

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
// @access  Public
exports.removeSpecificCartItem = asyncHandler(async (req, res, next) => {
  const userId = req.user ? req.user._id : null;
  const cartId = req.query.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  let cart;
  if (userId) {
    cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { cartItems: { _id: req.params.itemId } } },
      { new: true }
    );
  } else if (cartId) {
    cart = await Cart.findOneAndUpdate(
      { _id: cartId, user: null },
      { $pull: { cartItems: { _id: req.params.itemId } } },
      { new: true }
    );
  } else {
    cart = await Cart.findOneAndUpdate(
      { clientIp, user: null },
      { $pull: { cartItems: { _id: req.params.itemId } } },
      { new: true }
    );
  }

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
// @access  Public
exports.clearCart = asyncHandler(async (req, res, next) => {
  const userId = req.user ? req.user._id : null;
  const cartId = req.query.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  let cart;
  if (userId) {
    cart = await Cart.findOneAndDelete({ user: userId });
  } else if (cartId) {
    cart = await Cart.findOneAndDelete({ _id: cartId, user: null });
  } else {
    cart = await Cart.findOneAndDelete({ clientIp, user: null });
  }

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  res.status(204).send();
});

// @desc    Update specific cart item quantity
// @route   PUT /api/v1/cart/:itemId
// @access  Public
exports.updateCartItemQuantity = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const userId = req.user ? req.user._id : null;
  const cartId = req.query.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1) {
    return next(new ApiError('Quantity must be a positive integer', 400));
  }

  let cart;
  if (userId) {
    cart = await Cart.findOne({ user: userId });
  } else if (cartId) {
    cart = await Cart.findOne({ _id: cartId, user: null });
  } else {
    cart = await Cart.findOne({ clientIp, user: null });
  }

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === req.params.itemId
  );
  if (itemIndex > -1) {
    const cartItem = cart.cartItems[itemIndex];
    cartItem.quantity = quantity;
    cart.cartItems[itemIndex] = cartItem;
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
// @access  Public
exports.applyCoupon = asyncHandler(async (req, res, next) => {
  // 1) Get coupon based on coupon name
  const coupon = await Coupon.findOne({
    name: req.body.coupon,
    expire: { $gt: Date.now() },
  });

  if (!coupon) {
    return next(new ApiError('Coupon is invalid or expired', 400));
  }

  // 2) Get cart
  const userId = req.user ? req.user._id : null;
  const cartId = req.query.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  let cart;
  if (userId) {
    cart = await Cart.findOne({ user: userId });
  } else if (cartId) {
    cart = await Cart.findOne({ _id: cartId, user: null });
  } else {
    cart = await Cart.findOne({ clientIp, user: null });
  }

  if (!cart) {
    return next(new ApiError('Cart not found', 404));
  }

  // 3) Calculate price after discount
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

// @desc    Merge guest cart with user cart after login
// @route   POST /api/v1/cart/mergeGuestCart
// @access  Private/User
exports.mergeGuestCart = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const cartId = req.body.cartId;
  const clientIp = req.ip || req.connection.remoteAddress;

  // Find the guest cart
  let guestCart;
  if (cartId) {
    guestCart = await Cart.findOne({ _id: cartId, user: null });
  } else {
    guestCart = await Cart.findOne({ clientIp, user: null });
  }

  if (!guestCart) {
    return next(new ApiError('Guest cart not found', 404));
  }

  // Find or create the user cart
  let userCart = await Cart.findOne({ user: userId });
  if (!userCart) {
    // If the user doesn't have a cart, update the guest cart with the user ID
    userCart = await Cart.findOneAndUpdate(
      { _id: guestCart._id, user: null },
      { user: userId, clientIp: undefined }, // Clear clientIp
      { new: true }
    );
  } else {
    // Merge cart items from guest cart to user cart
    guestCart.cartItems.forEach((guestItem) => {
      const itemIndex = userCart.cartItems.findIndex(
        (item) =>
          item.product.toString() === guestItem.product.toString() &&
          item.color === guestItem.color
      );
      if (itemIndex > -1) {
        // Item exists, update quantity
        userCart.cartItems[itemIndex].quantity += guestItem.quantity;
      } else {
        // Item doesn't exist, add it
        userCart.cartItems.push(guestItem);
      }
    });

    // Recalculate total price
    calcTotalCartPrice(userCart);
    await userCart.save();

    // Delete the guest cart
    await Cart.findByIdAndDelete(guestCart._id);
  }

  res.status(200).json({
    status: 'success',
    message: 'Guest cart merged successfully',
    numOfCartItems: userCart.cartItems.length,
    data: userCart,
  });
});