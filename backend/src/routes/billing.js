const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { startCheckout, cancelMySubscription } = require('../controllers/billingController');

const router = express.Router();

router.post('/checkout', requireAuth, startCheckout);
router.post('/cancel', requireAuth, cancelMySubscription);

module.exports = router;
