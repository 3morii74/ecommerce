const express = require('express');

const router = express.Router();
const DailyAccess = require('../models/dailyAccessModel');
const authService = require('../services/authService'); // Assuming you have an auth service

// Admin endpoint: Get daily access counts
router.get(
  '/',
  authService.protect, // Ensure user is authenticated
  authService.allowedTo('admin'), // Restrict to admins
  async (req, res) => {
    try {
      const dailyAccess = await DailyAccess.find()
        .sort({ date: -1 }) // Sort by date, newest first
        .lean(); // Convert to plain JavaScript object for better performance

      if (!dailyAccess || dailyAccess.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No daily access data found',
        });
      }

      res.status(200).json({
        status: 'success',
        data: dailyAccess,
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Error fetching daily access counts',
        error: error.message,
      });
    }
  }
);

module.exports = router;