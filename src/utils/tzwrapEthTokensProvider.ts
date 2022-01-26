import { detailedDAppDataProvider } from "./better-call-dev";
import { getMarketsBySymbols } from "./coingecko";
import SingleQueryDataProvider from "./SingleQueryDataProvider";

const tzwrapEthTokensProvider = new SingleQueryDataProvider(
  14 * 60 * 1000,
  async () => {
    const tzwrapDetails = await detailedDAppDataProvider.get("tzwrap");

    if (tzwrapDetails.error) {
      throw tzwrapDetails.error;
    }

    const tokens = tzwrapDetails.data?.tokens ?? [];

    const ethTokens = tokens.filter(
      ({ symbol }) => symbol?.toLowerCase() !== "wrap"
    );

    const ethTokensSymbols = ethTokens.map(
      ({ token_info }) => token_info?.eth_symbol
    );

    const markets = await getMarketsBySymbols(ethTokensSymbols);

    return markets.map(({ symbol, current_price }) => {
      const token = ethTokens.find(
        ({ token_info }) =>
          token_info?.eth_symbol.toLowerCase() === symbol.toLowerCase()
      )!;
      return {
        ...token,
        price: current_price,
      };
    });
  }
);

export default tzwrapEthTokensProvider;
