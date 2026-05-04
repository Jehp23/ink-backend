const express = require('express');
const router = express.Router();
const { analyzeContract, getAnalysisByProjectId, getReportFromIpfs } = require('../controllers/analyzerController');
const { countDistinctAddresses } = require("./../models/ContractAnalysis");

// POST /analyze
router.post('/analyze', analyzeContract);

// GET /stats — unique contracts analyzed
router.get('/stats', async (req, res) => {
  try {
    const total = await countDistinctAddresses();
    res.json({ total });
  } catch {
    res.json({ total: 0 });
  }
});

// GET /analysis/project/:projectId — fetch report by blockchain projectId
router.get('/analysis/project/:projectId', getAnalysisByProjectId);

// GET /analysis/ipfs/:cid — fetch raw report from IPFS
router.get('/analysis/ipfs/:cid', getReportFromIpfs);

module.exports = router;
