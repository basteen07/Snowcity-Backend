const express = require('express');
const router = express.Router();

const { pool } = require('../config/db');
const payphi = require('../config/payphi');
const createHttpClient = require('../config/axios');

const isTrue = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

async function shallowPing(baseURL) {
  try {
    const http = createHttpClient({ baseURL, timeout: 4000 });
    const resp = await http.get('/', { validateStatus: () => true });
    return { reachable: true, status: resp.status };
  } catch (e) {
    return { reachable: false, error: e.message };
  }
}

// GET /api/payments/health
router.get('/health', async (req, res) => {
  try {
    let dbOk = false;
    try { await pool.query('SELECT 1'); dbOk = true; } catch {}

    const configured = !!(process.env.PAYPHI_MERCHANT_ID && process.env.PAYPHI_SECRET_KEY);
    let sampleHash = null;
    if (configured) {
      const payload = {
        addlParam1: 'Test1',
        addlParam2: 'Test2',
        amount: '300.00',
        currencyCode: '356',
        customerEmailID: 'test@gmail.com',
        customerMobileNo: '917498791441',
        merchantId: process.env.PAYPHI_MERCHANT_ID,
        merchantTxnNo: `HEALTH${Date.now()}`,
        payType: '0',
        returnURL: process.env.PAYPHI_RETURN_URL || '',
        transactionType: 'SALE',
        txnDate: payphi.formatTxnDate(),
      };
      sampleHash = payphi.computeInitiateHash(payload);
    }

    const doDeep = isTrue(process.env.PAYMENTS_DEEP_CHECK);
    const reachability = configured && doDeep
      ? await shallowPing((process.env.PAYPHI_BASE_URL || '').replace(/\/+$/, ''))
      : null;

    res.json({
      ok: dbOk && configured,
      db: { ok: dbOk },
      payphi: {
        configured,
        baseURL: process.env.PAYPHI_BASE_URL || null,
        merchantId: process.env.PAYPHI_MERCHANT_ID ? '***' + String(process.env.PAYPHI_MERCHANT_ID).slice(-4) : null,
        returnURL: process.env.PAYPHI_RETURN_URL || null,
        sampleHash,
        reachability,
      },
      notes: doDeep ? 'Deep checks enabled' : 'Set PAYMENTS_DEEP_CHECK=true to ping base URL',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/payments/payphi/hash-preview
router.post('/payphi/hash-preview', express.json(), (req, res) => {
  try {
    const p = req.body || {};
    if (!p.txnDate) p.txnDate = payphi.formatTxnDate();
    const hashText = payphi.buildCanonicalConcatString(p);
    const computedSecureHash = payphi.computeInitiateHash(p);
    res.json({
      note: 'secureHash = HMAC-SHA256(hashText, secret), lowercase hex; hashText is ascending concat of non-empty params',
      keys: Object.keys(p).sort(),
      hashText,
      computedSecureHash,
      payloadEcho: p,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;