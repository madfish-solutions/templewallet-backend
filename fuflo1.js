const sites = [
  "www.youtube.com",
  "www.coingecko.com",
  "etherscan.io",
  /* "www.dextools.io",
  "coinmarketcap.com",
  "dexscreener.com",
  "neuralwriter.com", */
  "bscscan.com",
  "www.chess.com",
  // "www.photopea.com",
  "tzkt.io",
  /* "polygonscan.com",
  "www.freepik.com", */
  "rollercoin.com",
  /* "mobalytics.gg",
  "www.solitalian.it",
  "stackoverflow.com",
  "ezgif.com",
  "udn.com",
  "mail01.orange.fr",
  "www.mlb.com",
  "solscan.io",
  "www.leagueofgraphs.com",
  "captcha.bot",
  "www.op.gg",
  "www.sahibinden.com",
  "www.fmkorea.com",
  "www.sozcu.com.tr",
  "www.dailymotion.com",
  "www.leboncoin.fr",
  "www.espn.com",
  "www.geckoterminal.com", */
  "claimbits.net",
  /* "quizlet.com",
  "onlinezen.online",
  "www.yahoo.com",
  "www.pixilart.com",
  "www.thingiverse.com",
  "www.speedtest.net",
  "www.quora.com",
  "www.geny.com", */
  "www.w3schools.com",
  /* "www.merriam-webster.com",
  "universitieshub.store",
  "eksisozluk.com",
  "industi.online",
  "slickdeals.net",
  "socialcounts.org",
  "www.ivoox.com",
  "temp-mail.org",
  "tw.news.yahoo.com",
  "tw.nextapple.com",
  "www.gazzetta.it",
  "w2g.tv",
  "devlopweb.online",
  "www.dailymail.co.uk",
  "www.dcard.tw",
  "www.geeksforgeeks.org",
  "basescan.org",
  "pomofocus.io",
  "tw.yahoo.com",
  "deepai.org",
  "5tars.io",
  "as.com",
  "blogchain.eu.org",
  "vnexpress.net",
  "tureng.com",
  "autofaucet.dutchycorp.space",
  "www.infobae.com",
  "www.cricbuzz.com",
  "www.cnn.com",
  "dgb.lol",
  "u.gg",
  "inconvertiblemoney.online",
  "www.procyclingstats.com", */
  "firefaucet.win",
  "www.blockchain.com",
  /* "www.marca.com",
  "www.zillow.com",
  "www.draftkings.com",
  "www.javatpoint.com",
  "www.publish0x.com",
  "www.arkadium.com",
  "kiddyearner.com",
  "t.17track.net",
  "www.coindesk.com",
  "www.programiz.com",
  "www.pixels.tips",
  "genius.com",
  "tw.stock.yahoo.com",
  "www.ebay.com",
  "poki.com",
  "www.olx.ua",
  "www.kleinanzeigen.de",
  "www.ynet.co.il",
  "www.news.com.au",
  "earn-pepe.com",
  "www.slideshare.net", */
  "www.chinatimes.com"
];

const axios = require('axios');

(async () => {
  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    const t0 = Date.now();
    try {
      const response = await axios.get(`http://localhost:3001/api/get-ad-category`, { params: { url: `https://${site}` } });
      console.log(site, `${Date.now() - t0}ms`, response.data.join(', '));
    } catch (e) {
      console.error(site, e);
    }
  }
})();
