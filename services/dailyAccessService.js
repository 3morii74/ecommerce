const DailyAccess = require('../models/dailyAccessModel');

exports.incrementDailyAccess = async (userId, ipAddress) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to midnight of the current day
  const identifier = userId ? userId.toString() : ipAddress; // Use userId if authenticated, else IP

  let dailyAccess = await DailyAccess.findOne({ date: today });

  if (!dailyAccess) {
    // Create new document if none exists for today
    dailyAccess = new DailyAccess({
      date: today,
      count: 0,
      uniqueUsers: [],
    });
  }

  // Increment count only if user hasn’t been counted today
  if (!dailyAccess.uniqueUsers.includes(identifier)) {
    dailyAccess.count += 1;
    dailyAccess.uniqueUsers.push(identifier);
    await dailyAccess.save();
  }
};