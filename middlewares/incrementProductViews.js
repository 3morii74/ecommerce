const Product = require('../models/productModel');
const ApiError = require('../utils/apiError');

const incrementProductViews = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new ApiError('No product found with that ID', 404));
    }
    product.views += 1;
    await product.save();
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = incrementProductViews;