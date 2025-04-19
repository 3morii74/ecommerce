const express = require('express');


const { searchProducts } = require('../services/ProductSearchService');

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { q } = req.query; // Search term from query parameter
        const products = await searchProducts(q);
        res.status(200).json({
            status: 'success',
            results: products.length,
            data: { products },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;