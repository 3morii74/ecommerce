const stripe = require('stripe')(process.env.STRIPE_SECRET);
const asyncHandler = require('express-async-handler');
const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');
const productOrderService = require('./productOrderService');
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
  console.log('Request body:', req.body);

  // 1) Validate input
  const { products, shippingAddress, coupon } = req.body;
  if (!products || !Array.isArray(products) || products.length === 0) {
    return next(new ApiError('Products array is required and cannot be empty', 400));
  }
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return next(new ApiError('Shipping address is required', 400));
  }
  const { alias, details, phone, city, postalCode, email } = shippingAddress;
  if (!alias || !details || !phone || !city) {
    return next(new ApiError('Shipping address must include alias, details, phone, and city', 400));
  }

  // 2) Validate products and calculate subtotal
  const cartItems = [];
  const productDetails = [];
  let subtotal = 0;

  const productValidations = await Promise.all(
    products.map(async (productInput, index) => {
      const { id, quantity = 1, color } = productInput;
      if (!id) {
        throw new ApiError(`Product at index ${index} must have an _id`, 400);
      }

      const parsedQuantity = Number(quantity);
      if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
        throw new ApiError(`Invalid quantity for product at index ${index}: ${quantity}`, 400);
      }

      const product = await Product.findById(id).select('title price');
      if (!product) {
        throw new ApiError(`No product found with id ${id} at index ${index}`, 404);
      }

      return {
        product: id,
        title: product.title,
        color: color || 'N/A',
        price: product.price,
        quantity: parsedQuantity,
        total: product.price * parsedQuantity,
      };
    })
  );

  productValidations.forEach((item) => {
    cartItems.push({
      product: item.product,
      color: item.color,
      price: item.price,
      name: item.title,
      quantity: item.quantity,
    });
    productDetails.push({
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    });
    subtotal += item.total;
  });

  console.log('cartItems before Order.create:', cartItems);

  const totalBeforeDiscount = subtotal;

  // 3) Validate and apply coupon (if provided)
  let totalAfterDiscount = totalBeforeDiscount;
  let couponId = null;
  let couponName = null;
  let discountAmount = 0;
  let discountPercentage = 0;

  if (coupon) {
    const couponDoc = await Coupon.findOne({ name: coupon });
    if (!couponDoc) {
      return next(new ApiError(`Invalid coupon name: ${coupon}`, 400));
    }

    if (!couponDoc.expire) {
      return next(new ApiError(`Coupon ${coupon} has no expiration date`, 400));
    }
    if (Number.isNaN(new Date(couponDoc.expire).getTime())) {
      return next(new ApiError(`Coupon ${coupon} has an invalid expiration date`, 400));
    }
    if (couponDoc.expire < new Date()) {
      return next(new ApiError(`Coupon ${coupon} has expired`, 400));
    }

    discountPercentage = couponDoc.discount;
    if (discountPercentage < 0 || discountPercentage > 100) {
      return next(new ApiError(`Invalid discount percentage: ${discountPercentage}`, 400));
    }
    discountAmount = (totalBeforeDiscount * discountPercentage) / 100;
    totalAfterDiscount = Math.max(0, totalBeforeDiscount - discountAmount);

    couponId = couponDoc._id;
    couponName = couponDoc.name;
  }

  // 4) Create order
  const userId = req.user ? req.user._id : null;
  const orderData = {
    user: userId,
    cartItems,
    shippingAddress: { alias, details, phone, city, postalCode, email },
    totalBeforeDiscount,
    totalAfterDiscount,
    coupon: couponId,
    paymentMethodType: 'cash',
  };

  console.log('Order data before creation:', orderData);

  const order = await Order.create(orderData);

  console.log('Order after creation:', order);

  if (!order.orderId) {
    console.error('Order created but orderId is missing:', order);
    return next(new ApiError('Failed to generate orderId for the order', 500));
  }

  // 5) Update product sold count
  const bulkOption = cartItems.map((item) => {
    const quantityToIncrement = Number(item.quantity);
    if (Number.isNaN(quantityToIncrement) || quantityToIncrement <= 0) {
      throw new ApiError(`Invalid quantity for product ${item.product}: ${item.quantity}`, 400);
    }
    return {
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { sold: quantityToIncrement } },
      },
    };
  });
  await Product.bulkWrite(bulkOption, {});

  await Promise.all(
    cartItems.map(async (item) => {
      await productOrderService.updateOrderCount(item.product);
    })
  );

  // 6) Send confirmation emails
  const orderItemsTableRows = productDetails
    .map((item) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.title}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.price} LE</td>
      </tr>
    `)
    .join('');

  if (email) {
    const customerMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
        <img src="https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/15ad48536f43ae127e96052f66c9998b~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=429e3bbc&x-expires=1745686800&x-signature=e1V4wZQdr0DWdp51po7D6wXvMqM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my" alt="Dodo's Bakes Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h2 style="color: #333; text-align: center;">Thank You for Your Order!</h2>
        <p style="color: #555;">Hi ${alias},</p>
        <p style="color: #555;">Thank you for shopping with Dodo's Bakes! Here are your order details:</p>
        <p style="color: #555;"><strong>Order ID:</strong> ${order.orderId}</p>
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
        <p style="color: #555;"><strong>Subtotal:</strong> ${subtotal.toFixed(2)} LE</p>
        ${couponName
          ? `<p style="color: #555;"><strong>Coupon Applied (${couponName}):</strong> -${discountAmount.toFixed(2)} LE (${discountPercentage}%)</p>`
          : ''
        }
        <p style="color: #555;"><strong>Total Before Discount:</strong> ${totalBeforeDiscount.toFixed(2)} LE</p>
        <p style="color: #555;"><strong>Total After Discount:</strong> ${totalAfterDiscount.toFixed(2)} LE</p>
        <p style="color: #555;"><strong>Shipping Address:</strong><br>
          ${alias}, ${details}, ${city}${postalCode ? `, ${postalCode}` : ''}<br>
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
      subject: "Your Dodo's Bakes Order Confirmation",
      message: customerMessage.replace(/<[^>]+>/g, ''),
      html: customerMessage,
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9;">
        <img src="https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/15ad48536f43ae127e96052f66c9998b~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=429e3bbc&x-expires=1745686800&x-signature=e1V4wZQdr0DWdp51po7D6wXvMqM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my" alt="Dodo's Bakes Logo" style="max-width: 150px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
        <h2 style="color: #333; text-align: center;">New Cash Order Notification</h2>
        <p style="color: #555;">Hello Admin,</p>
        <s
      <p style="color: #555;">A new cash order has been placed on Dodo's Bakes.</p>
        <p style="color: #555;"><strong>Order ID:</strong> ${order.orderId}</p>
        <p style="color: #555;"><strong>Customer:</strong> ${req.user ? req.user.name : alias}</p>
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
        <p style="color: #555;"><strong>Subtotal:</strong> ${subtotal.toFixed(2)} LE</p>
        ${couponName
          ? `<p style="color: #555;"><strong>Coupon Applied (${couponName}):</strong> -${discountAmount.toFixed(2)} LE (${discountPercentage}%)</p>`
          : ''
        }
        <p style="color: #555;"><strong>Total Before Discount:</strong> ${totalBeforeDiscount.toFixed(2)} LE</p>
        <p style="color: #555;"><strong>Total After Discount:</strong> ${totalAfterDiscount.toFixed(2)} LE</p>
        <p style="color: #555;"><strong>Shipping Address:</strong><br>
          ${alias}, ${details}, ${city}${postalCode ? `, ${postalCode}` : ''}<br>
          Phone: ${phone}</p>
        <p style="color: #555;">Please review the order in the admin panel.</p>
        <p style="color: #777; text-align: center;">Dodos Team</p>
      </div>
    `;
    await sendEmail({
      email: adminEmail,
      subject: `New Cash Order Placed - Order ID: ${order.orderId}`,
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
      coupon: couponName ? { name: couponName, discount: discountAmount, percentage: discountPercentage } : null,
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
exports.findSpecificOrder = asyncHandler(async (req, res, next) => {
  // Allow admins to include soft-deleted orders via query parameter
  const includeDeleted = req.user.role === 'admin' && req.query.includeDeleted === 'true';

  const order = await Order.findById(req.params.id)
    .setOptions({ includeDeleted }) // Pass includeDeleted to the query
    .populate({
      path: 'user',
      select: 'name email phone',
      match: { _id: { $ne: null } },
    })
    .populate({
      path: 'cartItems.product',
      select: 'title imageCover',
    });

  if (!order) {
    return next(
      new ApiError(`No order found for this id: ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    status: 'success',
    data: order,
  });
});

// @desc    Get all soft-deleted orders
// @route   GET /api/v1/orders/deleted
// @access  Protected/Admin
exports.findDeletedOrders = asyncHandler(async (req, res, next) => {
  // Explicitly query for deleted orders
  const query = Order.find({ deleted: true }).setOptions({ includeDeleted: true });

  const orders = await query
    .populate({
      path: 'user',
      select: 'name email phone',
      match: { _id: { $ne: null } },
    })
    .populate({
      path: 'cartItems.product',
      select: 'title imageCover',
    });

  // Debug: Log the orders to verify the deleted field
  console.log('Fetched deleted orders:', orders.map(order => ({
    _id: order._id,
    deleted: order.deleted,
    deletedAt: order.deletedAt,
  })));

  // Filter out any non-deleted orders (just in case)
  const deletedOrders = orders.filter(order => order.deleted === true);

  if (!deletedOrders || deletedOrders.length === 0) {
    return next(new ApiError('No deleted orders found', 404));
  }

  res.status(200).json({
    status: 'success',
    results: deletedOrders.length,
    data: deletedOrders,
  });
});

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

// @desc    Soft delete an order
// @route   DELETE /api/v1/orders/:id/soft-delete
// @access  Protected/Admin
exports.softDeleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError(
        `There is no such order with this id: ${req.params.id}`,
        404
      )
    );
  }

  // Mark order as deleted
  order.deleted = true;
  order.deletedAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({
    status: 'success',
    message: 'Order has been soft deleted',
    data: updatedOrder,
  });
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