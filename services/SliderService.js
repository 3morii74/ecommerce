const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');

const factory = require('./handlersFactory');
const { uploadSingleImage } = require('../middlewares/uploadImageMiddleware');
const Slider = require('../models/slider');

// Upload single image
exports.uploadSliderImage = uploadSingleImage('image');

// Image processing
exports.resizeImage = asyncHandler(async (req, res, next) => {
    const filename = `slider-${uuidv4()}-${Date.now()}.jpeg`;

    if (req.file) {
        await sharp(req.file.buffer)
            .resize(1440, 540)
            .toFormat('jpeg')
            .jpeg({ quality: 95 })
            .toFile(`uploads/sliders/${filename}`);

        // Save image filename into our db
        req.body.image = filename;
    }

    next();
});

// @desc    Get list of sliders
// @route   GET /api/v1/sliders
// @access  Public
exports.getSliders = factory.getAll(Slider);

// @desc    Get specific slider by id
// @route   GET /api/v1/sliders/:id
// @access  Public
exports.getSlider = factory.getOne(Slider);

// @desc    Create slider
// @route   POST /api/v1/sliders
// @access  Private/Admin-Manager
exports.createSlider = factory.createOne(Slider);

// @desc    Update specific slider
// @route   PUT /api/v1/sliders/:id
// @access  Private/Admin-Manager
exports.updateSlider = factory.updateOne(Slider);

// @desc    Delete specific slider
// @route   DELETE /api/v1/sliders/:id
// @access  Private/Admin
exports.deleteSlider = factory.deleteOne(Slider);