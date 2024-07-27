const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const bot = require('./bot');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to database');
});


function verifyTelegramWebAppData(telegramInitData) {
  const initData = new URLSearchParams(telegramInitData);
  const hash = initData.get('hash');
  initData.delete('hash');
  initData.sort();

  let dataCheckString = '';
  for (const [key, value] of initData.entries()) {
    dataCheckString += `${key}=${value}\n`;
  }
  dataCheckString = dataCheckString.slice(0, -1);

  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN);
  const calculatedHash = crypto.createHmac('sha256', secret.digest()).update(dataCheckString).digest('hex');

  return calculatedHash === hash;
}


function authMiddleware(req, res, next) {
  const telegramInitData = req.headers['x-telegram-init-data'];
  if (!telegramInitData || !verifyTelegramWebAppData(telegramInitData)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}


app.use(authMiddleware);


app.post('/api/user', (req, res) => {
  const { userId } = req.body;
  db.query('SELECT * FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length === 0) {
      const referralCode = crypto.randomBytes(5).toString('hex');
      db.query('INSERT INTO users (id, balance, referral_code) VALUES (?, 0, ?)', [userId, referralCode], (insertErr) => {
        if (insertErr) {
          res.status(500).json({ error: 'Database error' });
          return;
        }
        res.json({ userId, balance: 0, referralCode });
      });
    } else {
      res.json(results[0]);
    }
  });
});


app.get('/api/balance/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query('SELECT balance FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ balance: results[0].balance });
  });
});


app.post('/api/balance/update', (req, res) => {
  const { userId, newBalance } = req.body;
  db.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], (err) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ success: true });
  });
});


app.get('/api/referral/:userId', (req, res) => {
  const userId = req.params.userId;
  db.query('SELECT referral_code FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ referralCode: results[0].referral_code });
  });
});


app.post('/api/referral/use', (req, res) => {
  const { userId, referralCode } = req.body;
  db.query('SELECT id FROM users WHERE referral_code = ?', [referralCode], (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'Invalid referral code' });
      return;
    }
    const referrerId = results[0].id;
    db.query('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)', [referrerId, userId], (insertErr) => {
      if (insertErr) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    });
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));