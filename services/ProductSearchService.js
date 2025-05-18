const Product = require('../models/productModel');

// Helper function to set image URLs, avoiding duplication for existing URLs
const setImageURL = (doc) => {
  console.log('setImageURL called for doc:', doc._id, 'imageCover:', doc.imageCover);
  const isUrl = (str) => /^https?:\/\//i.test(str);

  if (doc.imageCover && !isUrl(doc.imageCover)) {
    const imageUrl = `${process.env.BASE_URL}/products/${doc.imageCover}`;
    doc.imageCover = imageUrl;
  }
  if (doc.images) {
    const imagesList = [];
    doc.images.forEach((image) => {
      const imageUrl = isUrl(image) ? image : `${process.env.BASE_URL}/products/${image}`;
      imagesList.push(imageUrl);
    });
    doc.images = imagesList;
  }
};

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
        // Project to reshape the output (similar to populate)
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

    // Apply setImageURL logic to handle image URLs correctly
    products.forEach((doc) => {
        setImageURL(doc);
    });

    return products;
};