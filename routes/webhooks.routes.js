const express = require('express');
const router = express.Router();

const payphiReturn = require('../webhooks/payphi.return');

router.get('/payphi/return', payphiReturn);
router.post('/payphi/return', payphiReturn);

module.exports = router;