const express = require('express');
const router = express.Router();



const { auth, isStudent } = require('../middleware/auth');
const { capturePayment, paymentSuccess, paymentFailure, paymentCancel } = require('../controllers/payments');

// Capture payment initiation
router.post('/capturePayment/', auth, isStudent, capturePayment);

// Payment success/failure/cancellation
router.post("/ssl_success/:tran_id/:userId/:courseId",paymentSuccess);
router.post("/payment/fail", auth,paymentFailure);
router.post("/payment/cancel", paymentCancel);

// Verify payment
// router.post('/verifyPayment', auth, isStudent, verifyPayment);

module.exports = router;
