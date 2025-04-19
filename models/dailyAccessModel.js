const mongoose = require('mongoose');

const dailyAccessSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true, // Ensures one document per day
  },
  count: {
    type: Number,
    default: 0,
  },
  uniqueUsers: [
    {
      type: String, // Stores user IDs or IP addresses
    },
  ],
});

module.exports = mongoose.model('DailyAccess', dailyAccessSchema);