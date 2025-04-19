const express = require('express');

const {
  getSliderValidator,
  createSliderValidator,
  updateSliderValidator,
  deleteSliderValidator,
} = require('../utils/validators/sliderValidator.js');

const {
  getSliders,
  getSlider,
  createSlider,
  updateSlider,
  deleteSlider,
  uploadSliderImage,
  resizeImage,
} = require('../services/SliderService');

const authService = require('../services/authService');

const router = express.Router();

router
  .route('/')
  .get(getSliders)
  .post(
    authService.protect,
    authService.allowedTo('admin', 'manager'),
    uploadSliderImage,
    resizeImage,
    createSliderValidator,
    createSlider
  );

router
  .route('/:id')
  .get(getSliderValidator, getSlider)
  .put(
    authService.protect,
    authService.allowedTo('admin', 'manager'),
    uploadSliderImage,
    resizeImage,
    updateSliderValidator,
    updateSlider
  )
  .delete(
    authService.protect,
    authService.allowedTo('admin'),
    deleteSliderValidator,
    deleteSlider
  );

module.exports = router;