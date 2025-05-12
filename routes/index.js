const categoryRoute = require('./categoryRoute');
const subCategoryRoute = require('./subCategoryRoute');
const brandRoute = require('./brandRoute');
const productRoute = require('./productRoute');
const userRoute = require('./userRoute');
const authRoute = require('./authRoute');
const reviewRoute = require('./reviewRoute');
const wishlistRoute = require('./wishlistRoute');
const addressRoute = require('./addressRoute');
const couponRoute = require('./couponRoute');
const cartRoute = require('./cartRoute');
const orderRoute = require('./orderRoute');
const bestSellersRoutes = require('./bestSellersRoutes');
const dailyAccessRoutes = require('./dailyAccessRoutes');
const sliderRoutes = require('./sliderRoute');
const searchRoute = require('./searchRoute');


const mountRoutes = (app) => {
  app.use('/api/v1/categories', categoryRoute); //
  app.use('/api/v1/subcategories', subCategoryRoute);//
  app.use('/api/v1/brands', brandRoute);//
  app.use('/api/v1/products', productRoute); //
  app.use('/api/v1/users', userRoute);//
  app.use('/api/v1/auth', authRoute);//
  app.use('/api/v1/reviews', reviewRoute);//
  app.use('/api/v1/wishlist', wishlistRoute);//
  app.use('/api/v1/addresses', addressRoute);//
  app.use('/api/v1/coupons', couponRoute);//
  app.use('/api/v1/cart', cartRoute);//
  app.use('/api/v1/orders', orderRoute);//
  app.use('/api/v1/best-sellers', bestSellersRoutes);//
  app.use('/api/v1/daily-access', dailyAccessRoutes);//
  app.use('/api/v1/sliders', sliderRoutes);//
  app.use('/api/v1/search', searchRoute);//


};

module.exports = mountRoutes;
