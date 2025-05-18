const jwt = require('jsonwebtoken');

/**
 * Middleware to extract userId from JWT token (if provided)
 * Attaches userId to req.user if token is valid; otherwise, proceeds without req.user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const extractUserIdFromToken = (req, res, next) => {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    // Extract token if header exists and starts with 'Bearer '
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;
    console.log('Token:', token);

    if (token) {
        try {
            // Check if JWT_SECRET is defined
            if (!process.env.JWT_SECRET_KEY) {
                console.error('JWT_SECRET is not defined in environment variables');
                return next();
            }

            // Verify and decode the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

            // Attach userId to req.user (adjust field name based on your token payload)
            req.user = { _id: decoded.userId || decoded.id };
            console.log('User extracted from token:', req.user);
        } catch (error) {
            // Log invalid token for debugging, but don't block the request
            console.error('Invalid or expired token:', error.message);
        }
    } else {
        console.log('No valid token provided in request');
        req.user = null; // Explicitly set req.user to null for unauthenticated users
    }

    // Proceed to the next middleware/route handler
    next();
};

module.exports = extractUserIdFromToken;