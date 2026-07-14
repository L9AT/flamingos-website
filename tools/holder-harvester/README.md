# NFT Holder Harvester

Local web app for scanning NFT/token holder wallets from OpenSea collection links, Ethereum contract addresses, and Robinhood Chain collections.

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:5177
```

## Supported inputs

- OpenSea collection links, including `/fr/collection/...`
- OpenSea collections on Robinhood Chain
- Ethereum NFT contract addresses
- Robinhood Chain Blockscout token links, for example `https://robinhoodchain.blockscout.com/token/0x...`
- Bulk lists with one link or contract per line

## Features

- Auto / Ethereum / Robinhood chain selector
- Minimum holding filter
- Exclude wallet list
- Airdrop-ready CSV export with `wallet_address,amount`
- Bulk scanning with combined unique wallet export
- All CSV / All TXT export for all saved wallets
- Recent CSV/TXT list with one-click delete
- Clean progress bar without run log

## Robinhood Chain

For Robinhood Chain, the app uses Blockscout's holders CSV endpoint directly:
`/api/v2/tokens/{contract}/holders/csv?from_period=null&to_period=null`

## Files

- `server.js` - backend API and CSV export logic
- `public/index.html` - website HTML
- `public/styles.css` - website styles
- `public/app.js` - frontend logic
- `outputs/` - generated CSV/TXT files, created automatically
