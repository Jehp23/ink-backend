# Ink Backend — Smart Contract Risk API

REST API that fetches on-chain data from Avalanche C-Chain, computes a deterministic risk score, and generates a plain-language AI explanation via Groq.

**Live API:** https://ink-backend-mkis.onrender.com

---

## Endpoints

### `POST /analyze`

Analyzes a smart contract address.

**Request:**
```json
{
  "address": "0xb8EF3a190b68175000B74B4160d325FD5024760e",
  "chain": "avalanche",
  "language": "en"
}
```

**Response:**
```json
{
  "address": "0xb8ef3a...",
  "score": 65,
  "level": "High",
  "warnings": ["Top holder controls 61% of supply", "..."],
  "explanation": "This token shows several patterns common in scam projects...",
  "signals": { "contract_verified": false, "has_mint_function": true, "..." }
}
```

### `GET /health`
Returns `{ "status": "ok", "timestamp": "..." }`

### `GET /stats`
Returns `{ "total": 42 }` — unique contracts analyzed.

---

## How scoring works

The score (0–100) is computed **deterministically** by `scoringEngine.js` — the LLM never touches the score. 11 on-chain signals are evaluated:

| Signal | Points |
|--------|--------|
| Owner not renounced | +20 |
| Top 1 holder > 30% | +20 |
| Contract unverified | +15 |
| Top 10 holders > 60% | +15 |
| Mint function present | +10 |
| Blacklist function present | +10 |
| Transfer restrictions | +10 |
| Liquidity pool < 7 days old | +10 |
| Liquidity < $10,000 | +10 |
| Pause function present | +5 |
| Proxy/delegatecall detected | +5 |

Risk levels: **0–30** Low · **31–60** Medium · **61–100** High

---

## Tech stack

- **Node.js + Express**
- **MongoDB Atlas** — result cache (TTL 1h, keyed by address + language)
- **Routescan API** — holder concentration
- **Snowtrace API** — contract verification + source code
- **DexScreener API** — liquidity data
- **Avalanche RPC** — `owner()` call via ethers.js
- **Groq API** (Llama 3.3-70B) — AI explanation
- **Pinata IPFS** — report storage
- **Avalanche Fuji** — AnalysisRegistry smart contract

---

## Getting started

```bash
npm install
cp .env.example .env   # fill in your keys
node index.js
```

Server runs at [http://localhost:8000](http://localhost:8000).

## Environment variables

```env
PORT=8000
MONGO_URI=
AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
AVALANCHE_FUJI_RPC=https://api.avax-test.network/ext/bc/C/rpc
GROQ_API_KEY=
PINATA_JWT=
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
AVALANCHE_WALLET_PRIVATE_KEY=
ANALYSIS_REGISTRY_CONTRACT_ADDRESS=
ALLOWED_ORIGINS=*
```

## Smart contract

`AnalysisRegistry.sol` is deployed on Avalanche Fuji testnet at:
```
0x4386D77Fb0D81890a042E26139EAf917e39055F8
```

To redeploy:
```bash
node scripts/deployContract.js
```

## Deploy

Deployed on [Render](https://render.com). Set all environment variables in the Render dashboard.
