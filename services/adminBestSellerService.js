const AdminBestSeller = require('../models/adminBestSellerModel');

exports.addBestSeller = async (productId, adminId) => {
    const bestSeller = new AdminBestSeller({ productId, addedBy: adminId });
    return await bestSeller.save();
};

exports.getAdminBestSellers = async () =>
    await AdminBestSeller.find({ isActive: true })
        .populate('productId', 'title description price imageCover category') // Include image field for transformation
        .populate({
            path: 'productId.category', // Populate category inside productId
            select: 'name', // Only get the category name
        })
        .populate('addedBy', 'name');


exports.removeBestSeller = async (id) =>
    await AdminBestSeller.findByIdAndUpdate(id, { isActive: false }, { new: true });
