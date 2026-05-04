require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./src/config/db');
const analyzerRoutes = require('./src/routes/analyzerRoutes');

const app = express();
const PORT = process.env.PORT || 8000;

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS === '*'
  ? true
  : (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());

app.use(cors({ origin: allowedOrigins }));

// Rate limiting — general
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stricter rate limit for /analyze
app.use('/analyze', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.ANALYZE_RATE_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait before trying again.' },
}));

app.use(express.json());

// Neon DB — optional, cache disabled if DATABASE_URL not set
connectDB().catch(err => console.warn('⚠️  DB connect failed:', err.message));

app.use('/', analyzerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Ink backend running at http://localhost:${PORT}`);
});
