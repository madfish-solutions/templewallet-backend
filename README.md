# templewallet-backend

The Express backend which helps Temple Wallet to decrease amount of requests to BCD in order to get info about dApps or tokens exchange rates.

## Routes

| Path                    | Description                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| /api/dapps              | Provides a list of dApps with their TVL, summary TVL and amount of TEZ locked in them.                                                                                                                                      |
| /api/exchange-rates/tez | Returns a single number, which is TEZ to USD exchange rate according to markets tickers from tzstats.com                                                                                                                    |
| /api/exchange-rates     | Returns the exchange rates of tokens to USD based on Quipuswap and Dexter pools (for most of them), stats from TZero (only for Aspencoin) and exchange rates from Coingecko (for WRAP tokens which are still not in pools). |

## Building

Use `yarn run build` for building.

## Running with pm2

You can run the built backend using `pm2 restart templewallet-backend.json`.
