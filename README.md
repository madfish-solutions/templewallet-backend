# templewallet-backend

The Express backend which helps Temple Wallet to decrease amount of requests to BCD in order to get info about dApps or tokens exchange rates.

## Routes

| Path                    | Description                                                                                                                                                                                                                 |
| ----------------------- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| /api/dapps              | Provides a list of dApps with their TVL, summary TVL and amount of TEZ locked in them.                                                                                                                                      |
| /api/exchange-rates/tez | Returns a single number, which is TEZ to USD exchange rate according to markets tickers from tzstats.com                                                                                                                    |
| /api/exchange-rates     | Returns the exchange rates of tokens to USD based on Quipuswap and Dexter pools (for most of them), stats from TZero (only for Aspencoin) and exchange rates from Coingecko (for WRAP tokens which are still not in pools). |
| /api/moonpay-sign     | Returns signed MoonPay url                                                                                                                                                                                                  |

## Building

Use `yarn run build` for building.

## Building and running using Docker

Follow the instructions on [Building your image](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/#building-your-image) and [Running the image](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/#run-the-image). Change the port number in both `.env` and `Dockerfile` if the webapp should be run on another port than 3000.

## Running with pm2

You can run the built backend using `pm2 restart templewallet-backend.json`.

## Upstreaming using nginx

Append these lines into `server` block of `/etc/nginx/sites-available/default`:

```
location /api/dapps {
  proxy_http_version 1.1;
  proxy_cache_bypass $http_upgrade;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_pass http://localhost:3000;
}

location /api/exchange-rates/ {
  proxy_http_version 1.1;
  proxy_cache_bypass $http_upgrade;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  proxy_pass http://localhost:3000;
}
```

Replace 3000 with the respective port number if the backend is listening on a different one. Restart nginx using `sudo systemctl restart nginx` after changes are saved.
