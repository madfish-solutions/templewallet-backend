import { Schema } from "@taquito/michelson-encoder";
import DataProvider from "./DataProvider";
import { range } from "./helpers";
import { getBigMapValues, getStorage, KNOWN_NETWORKS, Network } from "./tezos";

export const networksTTDex: Partial<Record<Network, string>> = {
  mainnet: process.env.MAINNET_TTDEX_ADDRESS,
  granadanet: process.env.GRANADANET_TTDEX_ADDRESS,
  hangzhounet: process.env.HANGZHOUNET_TTDEX_ADDRESS,
};

export type TokenType = "fa1.2" | "fa2";

export const networksQuipuswapFactories: Record<
  Network,
  Record<TokenType, string[]>
> = {
  mainnet: {
    "fa1.2": process.env.MAINNET_QUIPUSWAP_FA12_FACTORIES?.split(",") ?? [],
    fa2: process.env.MAINNET_QUIPUSWAP_FA2_FACTORIES?.split(",") ?? [],
  },
  granadanet: {
    "fa1.2": process.env.GRANADANET_QUIPUSWAP_FA12_FACTORIES?.split(",") ?? [],
    fa2: process.env.GRANADANET_QUIPUSWAP_FA2_FACTORIES?.split(",") ?? [],
  },
  hangzhounet: {
    "fa1.2": process.env.HANGZHOUNET_QUIPUSWAP_FA12_FACTORIES?.split(",") ?? [],
    fa2: process.env.HANGZHOUNET_QUIPUSWAP_FA2_FACTORIES?.split(",") ?? [],
  },
};

type Token = {
  address: string;
  id?: string;
  type: TokenType;
};

type CommonPoolData = {
  type: "ttdex" | "tokenxtz";
  totalSupply: string;
  tokenAPool: string;
  tokenBPool: string;
  tokenA: Token;
};

export type TTDexPoolData = CommonPoolData & {
  type: "ttdex";
  tokenB: Token;
  id: number;
};

export type TokenXtzPoolData = CommonPoolData & {
  type: "tokenxtz";
  address: string;
  factoryAddress: string;
};

const contractAddressSchema = new Schema({ prim: "address" });

const getTTDexData = async (network: Network) => {
  const ttDexAddress = networksTTDex[network];

  if (!ttDexAddress) {
    return [];
  }

  const {
    storage: { pairs, pairs_count, tokens },
  } = await getStorage(ttDexAddress, network);

  return Promise.all(
    range(0, pairs_count.toNumber()).map(async (i) => {
      const { token_a_pool, token_b_pool, total_supply } = await pairs.get(i);
      const { token_a_type, token_b_type } = await tokens.get(i);
      return {
        type: "ttdex" as const,
        id: i,
        tokenAPool: token_a_pool.toFixed(),
        tokenBPool: token_b_pool.toFixed(),
        totalSupply: total_supply.toFixed(),
        tokenA: {
          type: token_a_type.fa12 ? ("fa1.2" as const) : ("fa2" as const),
          address: token_a_type.fa12 ?? token_a_type.token_address,
          id: token_a_type.token_id?.toFixed(),
        },
        tokenB: {
          type: token_b_type.fa12 ? ("fa1.2" as const) : ("fa2" as const),
          address: token_b_type.fa12 ?? token_b_type.token_address,
          id: token_b_type.token_id?.toFixed(),
        },
      };
    })
  );
};

const getTokenXtzPoolsData = async (network: Network) => {
  const { ["fa1.2"]: fa12Factories, ["fa2"]: fa2Factories } =
    networksQuipuswapFactories[network];
  const chunks = await Promise.all(
    [...fa12Factories, ...fa2Factories].map(async (factoryAddress) => {
      const { token_to_exchange: dexContractsBigMap } = await getStorage(
        factoryAddress,
        network
      );
      const exchangersAddresses: string[] = await getBigMapValues(
        dexContractsBigMap.toString(),
        network,
        contractAddressSchema
      );

      return Promise.all(
        exchangersAddresses.map(async (address) => {
          const {
            storage: {
              tez_pool,
              token_pool,
              token_id,
              token_address,
              total_supply,
            },
          } = await getStorage(address, network);

          const tokenA: Token = token_id
            ? {
                address: token_address,
                type: "fa2",
                id: token_id.toFixed(),
              }
            : {
                address: token_address,
                type: "fa1.2",
              };

          return {
            type: "tokenxtz" as const,
            address,
            tokenAPool: token_pool.toFixed(),
            tokenBPool: tez_pool.toFixed(),
            tokenA,
            totalSupply: total_supply.toFixed(),
            factoryAddress,
          };
        })
      );
    })
  );

  return chunks.flat();
};

const getPoolsData = async (network: Network) =>
  Promise.all([getTTDexData(network), getTokenXtzPoolsData(network)]).then(
    (poolsChunks) => poolsChunks.flat()
  );

export const poolsDataProvider = new DataProvider(30 * 1000, getPoolsData);
KNOWN_NETWORKS.forEach((network) => poolsDataProvider.subscribe(network));
