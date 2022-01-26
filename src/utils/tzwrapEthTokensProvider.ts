import { getMarketsBySymbols } from "./coingecko";
import SingleQueryDataProvider from "./SingleQueryDataProvider";
import { getBigMapValues, getStorage, getTokenMetadata } from "./tezos";

const tokensContractAddress = "KT18fp5rcTW7mbWDmzFwjLDUhs5MeJmagDSZ";

const tzwrapEthTokensProvider = new SingleQueryDataProvider(
  14 * 60 * 1000,
  async () => {
    const {
      assets: { token_metadata },
    } = await getStorage(tokensContractAddress);
    console.log("x1");
    const rawMetadataEntries = await getBigMapValues(token_metadata.toString());
    console.log("x2");
    const ethTokens = await Promise.all(
      rawMetadataEntries.map((_, index) =>
        getTokenMetadata(tokensContractAddress, String(index)).then((x) => {
          console.log(index);

          return x;
        })
      )
    );
    console.log(ethTokens);
    const ethTokensSymbols = ethTokens.map(
      ({ token_info }) => token_info!.eth_symbol
    );
    const markets = await getMarketsBySymbols(ethTokensSymbols);
    console.log(markets);
    return markets.map(({ symbol, current_price }) => {
      const token = ethTokens.find(
        ({ token_info }) =>
          token_info!.eth_symbol.toLowerCase() === symbol.toLowerCase()
      )!;
      return {
        ...token,
        price: current_price,
      };
    });
  }
);

export default tzwrapEthTokensProvider;
