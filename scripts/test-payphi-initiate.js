require('dotenv').config();
const payphi = require('../services/payphiService');

(async function() {
  try {
    console.log('Starting PayPhi initiate test...');
    const result = await payphi.initiate({
      merchantTxnNo: 'TEST' + Date.now(),
      amount: '1.00',
      customerEmailID: 'test@example.com',
      customerMobileNo: '919876543210',
      addlParam1: 'script-test',
      addlParam2: 'SnowCity',
      returnURL: process.env.PAYPHI_RETURN_URL
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error calling PayPhi:', err.message);
    if (err.data) console.error('Raw data:', JSON.stringify(err.data, null, 2));
    process.exit(1);
  }
})();
