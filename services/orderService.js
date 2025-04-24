const stripe = require('stripe')(process.env.STRIPE_SECRET);
const asyncHandler = require('express-async-handler');
const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');
const productOrderService = require('./productOrderService'); // Import the service
const Coupon = require('../models/couponModel');

const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const sendEmail = require('../utils/sendEmail');

// @desc    Create cash order
// @route   POST /api/v1/orders
// @access  Public
exports.createCashOrder = asyncHandler(async (req, res, next) => {


  // Log the incoming request for debugging
  console.log('Request body:', req.body);

  // 1) Validate input
  const { products, shippingAddress, coupon } = req.body;
  if (!products || !Array.isArray(products) || products.length === 0) {
    return next(new ApiError('Products array is required and cannot be empty', 400));
  }
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return next(new ApiError('Shipping address is required', 400));
  }
  const { details, city, phone, name, apartment, floor, street, email } = shippingAddress;
  if (!details || !city || !phone || !name) {
    return next(new ApiError('Shipping address must include details, city, phone, and name', 400));
  }

  // 2) Validate products and calculate subtotal
  const cartItems = [];
  const productDetails = []; // Store product details for email
  let subtotal = 0;

  // Process products concurrently with Promise.all and map
  const productValidations = await Promise.all(
    products.map(async (productInput, index) => {
      const { id, quantity = 1, color } = productInput;
      if (!id) {
        throw new ApiError(`Product at index ${index} must have an _id`, 400);
      }

      // Fetch product from database
      const product = await Product.findById(id).select('title price quantity');
      if (!product) {
        throw new ApiError(`No product found with id ${id} at index ${index}`, 404);
      }
      if (product.quantity < quantity) {
        throw new ApiError(`Insufficient stock for product ${product.title} at index ${index}`, 400);
      }

      return {
        product: id,
        title: product.title, // Store title for cartItems and email
        quantity,
        color: color || 'N/A',
        price: product.price,
        total: product.price * quantity,
      };
    })
  );

  // Aggregate product results
  productValidations.forEach((item) => {
    cartItems.push({
      product: item.product,
      quantity: item.quantity,
      color: item.color,
      price: item.price,
      name: item.title, // Add name for cartItems
    });
    productDetails.push({
      title: item.title,
      quantity: item.quantity,
      price: item.price,
    });
    subtotal += item.total;
  });

  // Debug: Log cartItems before saving
  console.log('cartItems before Order.create:', cartItems);

  // Calculate total before discount
  const totalBeforeDiscount = subtotal;

  // 3) Validate and apply coupon (if provided)
  let totalAfterDiscount = totalBeforeDiscount;
  let couponId = null;
  let couponName = null;
  let discountAmount = 0;

  if (coupon) {
    const couponDoc = await Coupon.findOne({ name: coupon });
    if (!couponDoc) {
      return next(new ApiError(`Invalid coupon name: ${coupon}`, 400));
    }

    // Check expiration
    if (!couponDoc.expire) {
      return next(new ApiError(`Coupon ${coupon} has no expiration date`, 400));
    }
    if (isNaN(new Date(couponDoc.expire).getTime())) {
      return next(new ApiError(`Coupon ${coupon} has an invalid expiration date`, 400));
    }
    if (couponDoc.expire < new Date()) {
      return next(new ApiError(`Coupon ${coupon} has expired`, 400));
    }

    // Apply fixed-amount discount
    discountAmount = couponDoc.discount;
    totalAfterDiscount = Math.max(0, totalBeforeDiscount - discountAmount);

    // Store coupon details
    couponId = couponDoc._id;
    couponName = couponDoc.name;
  }

  // 4) Create order
  const userId = req.user ? req.user._id : null; // Optional user ID for guests
  const order = await Order.create({
    user: userId,
    cartItems,
    shippingAddress: { details, city, phone, name, apartment, floor, street, email },
    totalBeforeDiscount,
    totalAfterDiscount,
    coupon: couponId,
    paymentMethodType: 'cash',
  });

  // Debug: Log order after creation
  console.log('Order after creation:', order);

  // 5) Update product quantity and sold count
  if (order) {
    const bulkOption = cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: +item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // Update ProductOrder counts for each product
    await Promise.all(
      cartItems.map(async (item) => {
        await productOrderService.updateOrderCount(item.product);
      })
    );
  }

  // 6) Send confirmation emails
  const orderItemsTableRows = productDetails
    .map((item) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.title}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">$${item.price}</td>
      </tr>
    `)
    .join('');

  // Customer email (only if email is provided)
  if (email) {
    const customerMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
        <img src="https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/15ad48536f43ae127e96052f66c9998b~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=429e3bbc&x-expires=1745686800&x-signature=e1V4wZQdr0DWdp51po7D6wXvMqM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my" alt="E-shop Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h2 style="color: #333; text-align: center;">Thank You for Your Order!</h2>
        <p style="color: #555;">Hi ${name},</p>
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
        <p style="color: #555;"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
        ${couponName
        ? `<p style="color: #555;"><strong>Coupon Applied (${couponName}):</strong> -$${discountAmount.toFixed(2)}</p>`
        : ''
      }
        <p style="color: #555;"><strong>Total Before Discount:</strong> $${totalBeforeDiscount.toFixed(2)}</p>
        <p style="color: #555;"><strong>Total After Discount:</strong> $${totalAfterDiscount.toFixed(2)}</p>
        <p style="color: #555;"><strong>Shipping Address:</strong><br>
          ${details}, ${city}${apartment ? `, ${apartment}` : ''}${floor ? `, ${floor}` : ''}${street ? `, ${street}` : ''}<br>
          Phone: ${phone}</p>
        <p style="color: #555;">We will notify you once your order is shipped.</p>
        <p style="color: #777; text-align: center;">
          Dodos Team<br>
          <a href="https://omarahmedd.com" style="color: #1a73e8; text-decoration: none;">Visit our website</a>
        </p>
      </div>
    `;
    await sendEmail({
      email,
      subject: 'Your E-shop Order Confirmation',
      message: customerMessage.replace(/<[^>]+>/g, ''),
      html: customerMessage,
    });
  }

  // Admin email
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
        <img src="https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/15ad48536f43ae127e96052f66c9998b~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=429e3bbc&x-expires=1745686800&x-signature=e1V4wZQdr0DWdp51po7D6wXvMqM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my" alt="E-shop Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h2 style="color: #333; text-align: center;">New Cash Order Notification</h2>
        <p style="color: #555;">Hello Admin,</p>
        <p style="color: #555;">A new cash order has been placed on E-shop.</p>
        <p style="color: #555;"><strong>Order ID:</strong> ${order._id}</p>
        <p style="color: #555;"><strong>Customer:</strong> ${req.user ? req.user.name : name}</p>
        <p style="color: #555;"><strong>Customer Email:</strong> ${email || 'N/A'}</p>
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
        <p style="color: #555;"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
        ${couponName
        ? `<p style="color: #555;"><strong>Coupon Applied (${couponName}):</strong> -$${discountAmount.toFixed(2)}</p>`
        : ''
      }
        <p style="color: #555;"><strong>Total Before Discount:</strong> $${totalBeforeDiscount.toFixed(2)}</p>
        <p style="color: #555;"><strong>Total After Discount:</strong> $${totalAfterDiscount.toFixed(2)}</p>
        <p style="color: #555;"><strong>Shipping Address:</strong><br>
          ${details}, ${city}${apartment ? `, ${apartment}` : ''}${floor ? `, ${floor}` : ''}${street ? `, ${street}` : ''}<br>
          Phone: ${phone}</p>
        <p style="color: #555;">Please review the order in the admin panel.</p>
        <p style="color: #777; text-align: center;">Dodos Team</p>
      </div>
    `;
    await sendEmail({
      email: adminEmail,
      subject: `New Cash Order Placed - Order ID: ${order._id}`,
      message: adminMessage.replace(/<[^>]+>/g, ''),
      html: adminMessage,
    });
  }

  // 7) Send response
  res.status(201).json({
    status: 'success',
    data: {
      order,
      totalBeforeDiscount: totalBeforeDiscount.toFixed(2),
      totalAfterDiscount: totalAfterDiscount.toFixed(2),
      coupon: couponName ? { name: couponName, discount: discountAmount } : null,
    },
  });
});


// @desc    Get orders for authenticated user or all orders for admin
// @route   GET /api/v1/orders
// @access  Protected (user, admin)
exports.getOrder = asyncHandler(async (req, res, next) => {
  // Check user role
  const query = req.user.role === 'admin' ? {} : { user: req.user._id };

  // Find orders with populated user and product details
  const orders = await Order.find(query)
    .populate({
      path: 'user',
      select: 'name email phone',
      match: { _id: { $ne: null } },
    })
    .populate({
      path: 'cartItems.product',
      select: 'title imageCover',
    });

  if (!orders || orders.length === 0) {
    return next(new ApiError('No orders found', 404));
  }

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: orders,
  });
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