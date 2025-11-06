const authService = require('../../services/authService');


exports.login = async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { email, password } = body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const out = await authService.login({ email, password });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { name, email, phone, password } = body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const out = await authService.register({ name, email, phone, password });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
};

// keep other methods as before, but always read from a guarded body:
// const body = (req.body && typeof req.body === 'object') ? req.body : {};

exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const out = await authService.register({ name, email, phone, password });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const out = await authService.login({ email, password });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await authService.logout(userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.sendOtp = async (req, res, next) => {
  try {
    const { user_id, email, phone, channel = 'sms' } = req.body || {};
    if (!user_id && !email && !phone) {
      return res.status(400).json({ error: 'Provide user_id or email or phone' });
    }
    const out = await authService.sendOtp({ user_id, email, phone, channel });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { user_id, otp } = req.body || {};
    if (!user_id || !otp) return res.status(400).json({ error: 'user_id and otp are required' });
    const out = await authService.verifyOtp({ user_id, otp });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });
    const out = await authService.forgotPassword({ email });
    res.json(out);
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code and newPassword are required' });
    }
    const out = await authService.resetPassword({ email, code, newPassword });
    res.json(out);
  } catch (err) {
    next(err);
  }
};