const dailyAccessService = require('../services/dailyAccessService');

const accessTrackerMiddleware = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null; // From authentication middleware

    // Get client IP from X-Forwarded-For or fallback
    let ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;

    // Handle multiple IPs in X-Forwarded-For (e.g., "client, proxy1, proxy2")
    if (ipAddress && ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim(); // Take the first (client) IP
    }

    // Clean up IP (remove IPv6 prefix if localhost)
    if (ipAddress === '::1' || ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.replace('::ffff:', '');
    }

    await dailyAccessService.incrementDailyAccess(userId, ipAddress);
  } catch (error) {
    console.error('Error tracking access:', error);
  }
  next();
};

module.exports = accessTrackerMiddleware;