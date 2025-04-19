const mongoose = require('mongoose');

// 1- Create Schema
const sliderSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: [true, 'Slider image required']
    }
  },
  { timestamps: true }
);

const setImageURL = (doc) => {
  if (doc.image) {
    const imageUrl = `${process.env.BASE_URL}/sliders/${doc.image}`;
    doc.image = imageUrl;
  }
};

// findOne, findAll and update
sliderSchema.post('init', (doc) => {
  setImageURL(doc);
});

// create
sliderSchema.post('save', (doc) => {
  setImageURL(doc);
});

// 2- Create model
const SliderModel = mongoose.model('Slider', sliderSchema);

module.exports = SliderModel;