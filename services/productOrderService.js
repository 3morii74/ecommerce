const ProductOrder = require('../models/productOrderModel');
const adminBestSellerService = require('./adminBestSellerService'); // Import admin best seller service
const ApiError = require('../utils/apiError');

exports.updateOrderCount = async (productId, quantity = 1) => {
  try {
    await ProductOrder.findOneAndUpdate(
      { productId },
      { $inc: { orderCount: quantity }, lastUpdated: Date.now() },
      { upsert: true, new: true }
    );
  } catch (error) {
    throw new ApiError('Failed to update product order count', 500);
  }
};

exports.getTopThreeOrdered = async () => {
  try {
    const topProducts = await ProductOrder.find()
      .sort({ orderCount: -1 })
      .limit(3)
      .populate('productId', 'title description imageCover price');

    if (!topProducts || topProducts.length === 0) {
      throw new ApiError('No products have been ordered yet', 404);
    }

    return topProducts.map(product => ({
      product: product.productId,
      orderCount: product.orderCount,
      lastUpdated: product.lastUpdated,
      source: 'ordered',
    }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Failed to fetch top ordered products', 500);
  }
};

exports.getCombinedBestSellers = async () => {
  try {
    // 1) Get top 3 ordered products
    let topOrdered = [];
    try {
      topOrdered = await exports.getTopThreeOrdered();
    } catch (error) {
      if (error.statusCode !== 404) throw error;
      // If no ordered products, proceed with admin best sellers
    }

    // 2) Get admin best sellers
    const adminBestSellers = await adminBestSellerService.getAdminBestSellers();

    // 3) Filter out duplicates (products already in topOrdered)
    const topOrderedProductIds = topOrdered.map(item => item.product._id.toString());
    const filteredAdminBestSellers = adminBestSellers
      .filter(item => !topOrderedProductIds.includes(item.productId._id.toString()))
      .map(item => ({
        product: item.productId,
        addedBy: item.addedBy,
        addedDate: item.addedDate,
        source: 'admin',
      }));

    // 4) Combine the results: top ordered first, then admin best sellers
    const combinedResults = [...topOrdered, ...filteredAdminBestSellers];

    if (combinedResults.length === 0) {
      throw new ApiError('No best sellers found', 404);
    }

    return combinedResults;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Failed to fetch best sellers', 500);
  }
};