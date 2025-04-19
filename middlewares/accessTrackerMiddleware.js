const dailyAccessService = require('../services/dailyAccessService');

const accessTrackerMiddleware = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null; // From authentication middleware
    const ipAddress = req.ip || req.connection.remoteAddress; // Client IP

    await dailyAccessService.incrementDailyAccess(userId, ipAddress);
  } catch (error) {
    console.error('Error tracking access:', error);
  }
  next();
};

module.exports = accessTrackerMiddleware;