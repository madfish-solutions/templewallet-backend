import DataProvider from "./DataProvider";
import { range } from "./helpers";
import { getStorage, KNOWN_NETWORKS, Network } from "./tezos";

export const networksTTDex: Partial<Record<Network, string>> = {
  mainnet: process.env.MAINNET_TTDEX_ADDRESS,
  granadanet: process.env.GRANADANET_TTDEX_ADDRESS
};

const getTTDexData = async (network: Network) => {
  const ttDexAddress = networksTTDex[network];
  if (!ttDexAddress) {
    return [];
  }
  const {
    storage: { pairs, pairs_count, tokens }
  } = await getStorage(ttDexAddress, "granadanet");
  return Promise.all(
    range(0, pairs_count.toNumber()).map(async (i) => {
      const { token_a_pool, token_b_pool, total_supply } = await pairs.get(i);
      const { token_a_type, token_b_type } = await tokens.get(i);
      return {
        id: i,
        tokenAPool: token_a_pool.toFixed(),
        tokenBPool: token_b_pool.toFixed(),
        totalSupply: total_supply.toFixed(),
        tokenAType: token_a_type.fa12 ? "fa1.2" : "fa2",
        tokenBType: token_b_type.fa12 ? "fa1.2" : "fa2",
        tokenAAddress: token_a_type.fa12 ?? token_a_type.token_address,
        tokenBAddress: token_b_type.fa12 ?? token_b_type.token_address,
        tokenAId: token_a_type.token_id?.toNumber(),
        tokenBId: token_b_type.token_id?.toNumber()
      };
    })
  );
};

export const ttDexDataProvider = new DataProvider(30 * 1000, getTTDexData);
KNOWN_NETWORKS.forEach((network) => ttDexDataProvider.subscribe(network));
