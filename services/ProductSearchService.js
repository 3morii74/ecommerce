const Product = require('../models/productModel');

exports.searchProducts = async (searchTerm) => {
    if (!searchTerm) {
        throw new Error('Search term is required');
    }

    const regex = new RegExp(searchTerm, 'i'); // Case-insensitive search

    const products = await Product.aggregate([
        // Lookup to join with the Category collection
        {
            $lookup: {
                from: 'categories', // The name of the Category collection in MongoDB
                localField: 'category',
                foreignField: '_id',
                as: 'category',
            },
        },
        // Unwind the category array (since $lookup returns an array)
        {
            $unwind: '$category',
        },
        // Match documents where title, description, or category name matches the search term
        {
            $match: {
                $or: [
                    { title: { $regex: regex } },
                    { description: { $regex: regex } },
                    { 'category.name': { $regex: regex } },
                ],
            },
        },
        // Optionally, project to reshape the output (similar to populate)
        {
            $project: {
                title: 1,
                slug: 1,
                description: 1,
                quantity: 1,
                sold: 1,
                price: 1,
                priceAfterDiscount: 1,
                colors: 1,
                imageCover: 1,
                images: 1,
                category: { name: '$category.name' }, // Only include the category name
                brand: 1,
                ratingsAverage: 1,
                ratingsQuantity: 1,
                views: 1,
                viewedBy: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    ]);

    // Manually apply the setImageURL logic since aggregation doesn't trigger middleware
    products.forEach((doc) => {
        if (doc.imageCover) {
            doc.imageCover = `${process.env.BASE_URL}/products/${doc.imageCover}`;
        }
        if (doc.images) {
            doc.images = doc.images.map((image) => `${process.env.BASE_URL}/products/${image}`);
        }
    });

    return products;
};