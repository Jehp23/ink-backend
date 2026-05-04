const { findCached, saveCache } = require('../models/ContractAnalysis');
const { analyzeContract, isValidEvmAddress } = require('../services/avalancheService');
const { computeScore, extractSignals } = require('../services/scoringEngine');
const { getAiPrediction } = require('../services/aiService');
const { pinJsonToIpfs, buildFullReport, buildMetadata, getFromIpfs, getGatewayUrl } = require('../services/ipfsService');
const { storeOnBlockchain, getAnalysisFromBlockchain, getLatestAnalysis, getAnalysisCount, isBlockchainConfigured } = require('../services/blockchainService');

const analyzeContractHandler = async (req, res) => {
  try {
    const { address, chain = 'avalanche', language = 'en' } = req.body;

    if (!address) {
      return res.status(400).json({ error: language === 'es' ? 'Falta el address del contrato' : 'Contract address is required' });
    }

    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: language === 'es' ? 'Dirección EVM inválida' : 'Invalid EVM address' });
    }

    const normalizedAddress = address.toLowerCase();

    // Cache lookup keyed by address+language (TTL 1h via Neon)
    try {
      const cached = await findCached(normalizedAddress, language);
      if (cached) {
        return res.status(200).json({
          address: cached.address,
          score: cached.score,
          level: cached.level,
          warnings: cached.warnings,
          explanation: cached.explanation,
          signals: cached.signals,
          cid: null,
          report_ipfs_url: cached.report_ipfs_url || null,
        });
      }
    } catch (_) {}

    const avalancheData = await analyzeContract(normalizedAddress);

    const signals = extractSignals(avalancheData);
    const { score, level, warnings, activeSignals } = computeScore(signals, language);

    const scoringResult = { score, level, warnings, activeSignals, signals };

    let explanation = null;
    try {
      const aiResult = await getAiPrediction(avalancheData, scoringResult, language);
      explanation = aiResult.explanation;
    } catch (llmError) {
      console.warn('LLM no disponible:', llmError.message);
    }

    // IPFS + Blockchain storage (optional — only if configured)
    let cid = null;
    let projectId = null;

    if (isBlockchainConfigured()) {
      try {
        const fullReport = buildFullReport(normalizedAddress, scoringResult, avalancheData, explanation);
        const ipfsResult = await pinJsonToIpfs(fullReport, `report-${normalizedAddress}.json`);
        cid = ipfsResult.cid;

        const metadata = buildMetadata(null, cid, normalizedAddress, scoringResult);
        await pinJsonToIpfs(metadata, `metadata-${normalizedAddress}.json`);

        const blockchainResult = await storeOnBlockchain(cid, JSON.stringify(metadata), normalizedAddress);
        projectId = blockchainResult.projectId;
      } catch (ipfsError) {
        console.warn('[IPFS/Blockchain] Error (no crítico):', ipfsError.message);
      }
    }

    const analysisResult = {
      address: normalizedAddress,
      chain,
      language,
      score,
      level,
      warnings,
      explanation: explanation || (language === 'es' ? 'Análisis disponible sin explicación IA.' : 'AI explanation unavailable.'),
      signals,
      tokenName:       avalancheData.contractState?.name   || null,
      tokenSymbol:     avalancheData.contractState?.symbol || null,
      cid:             cid,
      report_ipfs_url: cid ? getGatewayUrl(cid) : null,
      projectId:       projectId,
    };

    // Save to Neon cache
    try { await saveCache(analysisResult); } catch (_) {}

    return res.status(200).json(analysisResult);

  } catch (error) {
    console.error('Error en analyzeContract:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
};

const getAnalysisByProjectIdHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId || isNaN(parseInt(projectId))) {
      return res.status(400).json({ error: 'ProjectId inválido' });
    }
    if (!isBlockchainConfigured()) {
      return res.status(503).json({ error: 'Blockchain no configurado' });
    }
    const blockchainData = await getAnalysisFromBlockchain(parseInt(projectId));
    const fullReport = await getFromIpfs(blockchainData.cid);
    return res.status(200).json({
      projectId: blockchainData.projectId,
      cid: blockchainData.cid,
      report_ipfs_url: getGatewayUrl(blockchainData.cid),
      report: fullReport,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor', message: error.message });
  }
};

const getReportFromIpfsHandler = async (req, res) => {
  try {
    const { cid } = req.params;
    if (!cid) return res.status(400).json({ error: 'CID requerido' });
    const report = await getFromIpfs(cid);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor', message: error.message });
  }
};

module.exports = {
  analyzeContract: analyzeContractHandler,
  getAnalysisByProjectId: getAnalysisByProjectIdHandler,
  getReportFromIpfs: getReportFromIpfsHandler,
};
