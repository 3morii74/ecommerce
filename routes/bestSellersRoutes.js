const express = require('express');

const router = express.Router();
const productOrderService = require('../services/productOrderService');
const adminBestSellerService = require('../services/adminBestSellerService');
const authService = require('../services/authService');

// Public endpoint: Get combined best sellers (ordered first, then admin)
router.get('/', async (req, res) => {
    try {
        const bestSellers = await productOrderService.getCombinedBestSellers();
        res.status(200).json({ status: 'success', data: bestSellers });
    } catch (error) {
        res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
});

// Public endpoint: Get top 3 ordered products (keeping this for reference)
router.get('/ordered', async (req, res) => {
    try {
        const topProducts = await productOrderService.getTopThreeOrdered();
        res.status(200).json({ status: 'success', data: topProducts });
    } catch (error) {
        res.status(error.statusCode || 500).json({ status: 'error', message: error.message });
    }
});

// Admin endpoints (protected)
router.post(
    '/admin',
    authService.protect,
    authService.allowedTo('admin'),
    async (req, res) => {
        try {
            await adminBestSellerService.addBestSeller(req.body.productId, req.user._id);
            res.status(201).json({ status: 'success', message: 'Best seller added successfully' });
        } catch (error) {
            res.status(400).json({ status: 'error', message: 'Error adding best seller', error: error.message });
        }
    }
);

router.get(
    '/admin',
    authService.protect,
    authService.allowedTo('admin'),
    async (req, res) => {
        try {
            const bestSellers = await adminBestSellerService.getAdminBestSellers();
            res.status(200).json({ status: 'success', data: bestSellers });
        } catch (error) {
            res.status(500).json({ status: 'error', message: 'Error fetching admin best sellers', error: error.message });
        }
    }
);

router.delete(
    '/admin/:id',
    authService.protect,
    authService.allowedTo('admin'),
    async (req, res) => {
        try {
            await adminBestSellerService.removeBestSeller(req.params.id);
            res.status(200).json({ status: 'success', message: 'Best seller removed successfully' });
        } catch (error) {
            res.status(400).json({ status: 'error', message: 'Error removing best seller', error: error.message });
        }
    }
);

module.exports = router;