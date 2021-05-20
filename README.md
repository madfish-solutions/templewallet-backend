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

## Building and running using Docker

Setup environment variables by creating `.env` file with variables like in `.env.example`. Then follow the instructions on [Building your image](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/#building-your-image) and [Running the image](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/#building-your-image). Change the port number in both `.env` and `Dockerfile` if the webapp should be run on another port than 3000.

## Running with pm2

You can run the built backend using `pm2 restart dapps.json`.
