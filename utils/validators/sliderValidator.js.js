const { check } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');

exports.getSliderValidator = [
    check('id').isMongoId().withMessage('Invalid Slider id format'),
    validatorMiddleware,
];

exports.createSliderValidator = [
    check('image').notEmpty().withMessage('Slider image is required'),
    validatorMiddleware,
];

exports.updateSliderValidator = [
    check('id').isMongoId().withMessage('Invalid Slider id format'),
    validatorMiddleware,
];

exports.deleteSliderValidator = [
    check('id').isMongoId().withMessage('Invalid Slider id format'),
    validatorMiddleware,
];