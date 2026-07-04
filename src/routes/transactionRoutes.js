const express = require('express');
const TransactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/create', TransactionController.createTransaction);

module.exports = router;
