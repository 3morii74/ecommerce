const stripe = require('stripe')(process.env.STRIPE_SECRET);
const asyncHandler = require('express-async-handler');
const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');
const productOrderService = require('./productOrderService'); // Import the service

const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const sendEmail = require('../utils/sendEmail');

// @desc    Create cash order
// @route   POST /api/v1/orders/:cartId
// @access  Public
// In orderService.js
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  // App settings
  const taxPrice = 0;
  const shippingPrice = 0;

  // Log the incoming request for debugging
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);

  // 1) Get cart depend on cartId and populate product details
  const cart = await Cart.findById(req.params.cartId).populate({
    path: 'cartItems.product',
    select: 'title', // Only fetch the product title
  });

  // Log the cart to debug
  console.log('Cart found:', cart);

  if (!cart) {
    return next(
      new ApiError(`There is no such cart with id ${req.params.cartId}`, 404)
    );
  }

  // Check if cartItems is empty
  if (!cart.cartItems || cart.cartItems.length === 0) {
    return next(new ApiError('Cart is empty. Please add items to your cart.', 400));
  }

  // 2) Get order price depend on cart price "Check if coupon apply"
  const cartPrice = cart.totalPriceAfterDiscount
    ? cart.totalPriceAfterDiscount
    : cart.totalCartPrice;

  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 3) Create order with default paymentMethodType cash
  const userId = req.user ? req.user._id : null; // Optional user ID for guests
  const order = await Order.create({
    user: userId, // Will be null for guests
    cartItems: cart.cartItems,
    shippingAddress: req.body.shippingAddress,
    totalOrderPrice,
  });

  // 4) After creating order, decrement product quantity, increment product sold
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product._id }, // Use populated product ID
        update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // 5) Update ProductOrder counts for each product in the cart
    await Promise.all(
      cart.cartItems.map(async (item) => {
        await productOrderService.updateOrderCount(item.product._id);
      })
    );

    // 6) Clear cart depend on cartId
    await Cart.findByIdAndDelete(req.params.cartId);

    // 7) Send confirmation emails
    const orderItemsTableRows = cart.cartItems
      .map((item) => {
        // Log each item to debug
        console.log('Cart item:', item);
        // Check if product is populated
        const productName = item.product && item.product.title ? item.product.title : 'Unknown Product';
        return `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${productName}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity || 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${item.price || 'N/A'}</td>
          </tr>
        `;
      })
      .join('');

    // Customer email
    if (req.body.shippingAddress.email) {
      const customerMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
          <img src="https://omarahmedd.com/assets/icons/omer.png" alt="E-shop Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
          <h2 style="color: #333; text-align: center;">Thank You for Your Order!</h2>
          <p style="color: #555;">Hi ${req.body.shippingAddress.name || 'Customer'},</p>
          <p style="color: #555;">Thank you for shopping with E-shop! Here are your order details:</p>
          <p style="color: #555;"><strong>Order ID:</strong> ${order._id}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsTableRows}
            </tbody>
          </table>
          <p style="color: #555;"><strong>Total:</strong> $${totalOrderPrice}</p>
          <p style="color: #555;"><strong>Shipping Address:</strong><br>
            ${req.body.shippingAddress.details || ''}, ${req.body.shippingAddress.city || ''}, ${req.body.shippingAddress.postalCode || ''
        }<br>
            Phone: ${req.body.shippingAddress.phone || 'N/A'}</p>
          <p style="color: #555;">We will notify you once your order is shipped.</p>
          <p style="color: #777; text-align: center;">
            The E-shop Team<br>
            <a href="https://omarahmedd.com" style="color: #1a73e8; text-decoration: none;">Visit our website</a>
          </p>
        </div>
      `;
      await sendEmail({
        email: req.body.shippingAddress.email,
        subject: 'Your E-shop Order Confirmation',
        message: customerMessage.replace(/<[^>]+>/g, ''), // Text version for email clients that don't support HTML
        html: customerMessage, // HTML version
      });
    }

    // Admin email
    const adminEmail = process.env.ADMIN_EMAIL; // Define this in your .env file
    if (adminEmail) {
      const adminMessage = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
          <img src="https://omarahmedd.com/assets/icons/omer.png" alt="E-shop Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
          <h2 style="color: #333; text-align: center;">New Cash Order Notification</h2>
          <p style="color: #555;">Hello Admin,</p>
          <p style="color: #555;">A new cash order has been placed on E-shop.</p>
          <p style="color: #555;"><strong>Order ID:</strong> ${order._id}</p>
          <p style="color: #555;"><strong>Customer:</strong> ${req.user ? req.user.name : 'Guest'}</p>
          <p style="color: #555;"><strong>Customer Email:</strong> ${req.body.shippingAddress.email || 'N/A'}</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Quantity</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsTableRows}
            </tbody>
          </table>
          <p style="color: #555;"><strong>Total:</strong> $${totalOrderPrice}</p>
          <p style="color: #555;"><strong>Shipping Address:</strong><br>
            ${req.body.shippingAddress.details || ''}, ${req.body.shippingAddress.city || ''}, ${req.body.shippingAddress.postalCode || ''
        }<br>
            Phone: ${req.body.shippingAddress.phone || 'N/A'}</p>
          <p style="color: #555;">Please review the order in the admin panel.</p>
          <p style="color: #777; text-align: center;">The E-shop Team</p>
        </div>
      `;
      await sendEmail({
        email: adminEmail,
        subject: `New Cash Order Placed - Order ID: ${order._id}`,
        message: adminMessage.replace(/<[^>]+>/g, ''), // Text version
        html: adminMessage, // HTML version
      });
    }
  }

  res.status(201).json({ status: 'success', data: order });
});

exports.filterOrderForLoggedUser = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === 'user') {
    req.filterObj = { user: req.user._id };
  } else {
    req.filterObj = {}; // Allow admins/managers to see all orders
  }
  next();
});

// @desc    Get all orders
// @route   GET /api/v1/orders
// @access  Protected/User-Admin-Manager
exports.findAllOrders = factory.getAll(Order);

// @desc    Get specific order
// @route   GET /api/v1/orders/:id
// @access  Protected/User-Admin-Manager
exports.findSpecificOrder = factory.getOne(Order);

// @desc    Update order paid status to paid
// @route   PUT /api/v1/orders/:id/pay
// @access  Protected/Admin-Manager
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError(
        `There is no such order with this id: ${req.params.id}`,
        404
      )
    );
  }

  // Update order to paid
  order.isPaid = true;
  order.paidAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status: 'success', data: updatedOrder });
});

// @desc    Update order delivered status
// @route   PUT /api/v1/orders/:id/deliver
// @access  Protected/Admin-Manager
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError(
        `There is no such order with this id: ${req.params.id}`,
        404
      )
    );
  }

  // Update order to delivered
  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status: 'success', data: updatedOrder });
});

// @desc    Get checkout session from Stripe and send it as response
// @route   GET /api/v1/orders/checkout-session/:cartId
// @access  Public
exports.checkoutSession = asyncHandler(async (req, res, next) => {
  // App settings
  const taxPrice = 0;
  const shippingPrice = 0;

  // 1) Get cart depend on cartId
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(
      new ApiError(`There is no such cart with id ${req.params.cartId}`, 404)
    );
  }

  // 2) Get order price depend on cart price "Check if coupon apply"
  const cartPrice = cart.totalPriceAfterDiscount
    ? cart.totalPriceAfterDiscount
    : cart.totalCartPrice;

  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 3) Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'egp',
          product_data: {
            name: req.user ? req.user.name : 'Guest Customer',
          },
          unit_amount: totalOrderPrice * 100, // Amount in cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${req.protocol}://${req.get('host')}/orders`,
    cancel_url: `${req.protocol}://${req.get('host')}/cart`,
    customer_email: req.user ? req.user.email : req.body.email, // Allow email from request body for guests
    client_reference_id: req.params.cartId,
    metadata: req.body.shippingAddress,
  });

  // 4) Send session to response
  res.status(200).json({ status: 'success', session });
});

const createCardOrder = async (session) => {
  const cartId = session.client_reference_id;
  const shippingAddress = session.metadata;
  const orderPrice = session.amount_total / 100;

  const cart = await Cart.findById(cartId);
  if (!cart) {
    throw new Error(`Cart not found with id ${cartId}`);
  }

  // Try to find the user by email, but it's optional
  const user = session.customer_email
    ? await User.findOne({ email: session.customer_email })
    : null;

  // 3) Create order with default paymentMethodType card
  const order = await Order.create({
    user: user ? user._id : null, // Optional user ID
    cartItems: cart.cartItems,
    shippingAddress,
    totalOrderPrice: orderPrice,
    isPaid: true,
    paidAt: Date.now(),
    paymentMethod: 'card',
  });

  // 4) After creating order, decrement product quantity, increment product sold
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // 5) Clear cart depend on cartId
    await Cart.findByIdAndDelete(cartId);
  }
};

// @desc    This webhook will run when Stripe payment success paid
// @route   POST /webhook-checkout
// @access  Public
exports.webhookCheckout = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    // Create order
    await createCardOrder(event.data.object);
  }

  res.status(200).json({ received: true });
});