const CURRENCY_AND_TOKEN_FRAGMENTS = `
fragment ObjktCurrencyFields on currency {
  symbol
  decimals
}

fragment ObjktTokenFields on token {
  token_id
  name
  fa_contract
}
`;

export const GET_OFFERS_RECEIVED_QUERY = `
${CURRENCY_AND_TOKEN_FRAGMENTS}
query GetOffersReceived($since: timestamptz!, $lastId: bigint!, $limit: Int!) {
  event(
    where: {
      marketplace_event_type: { _eq: offer_create }
      timestamp: { _gte: $since }
      id: { _gt: $lastId }
      reverted: { _neq: true }
      token_pk: { _is_null: false }
    }
    order_by: { id: asc }
    limit: $limit
  ) {
    id
    timestamp
    price
    creator_address
    currency {
      ...ObjktCurrencyFields
    }
    token {
      ...ObjktTokenFields
    }
    token_pk
  }
}
`;

export const GET_AUCTION_BIDS_QUERY = `
${CURRENCY_AND_TOKEN_FRAGMENTS}
query GetAuctionBids($since: timestamptz!, $lastId: bigint!, $limit: Int!) {
  event(
    where: {
      marketplace_event_type: { _eq: english_auction_bid }
      timestamp: { _gte: $since }
      id: { _gt: $lastId }
      reverted: { _neq: true }
      token_pk: { _is_null: false }
    }
    order_by: { id: asc }
    limit: $limit
  ) {
    id
    timestamp
    price
    recipient_address
    currency {
      ...ObjktCurrencyFields
    }
    token {
      ...ObjktTokenFields
    }
  }
}
`;

export const GET_NFT_SALES_QUERY = `
${CURRENCY_AND_TOKEN_FRAGMENTS}
query GetNftSales($since: timestamptz!, $lastId: bigint!, $limit: Int!) {
  event(
    where: {
      _and: [
        { timestamp: { _gte: $since } }
        { id: { _gt: $lastId } }
        { reverted: { _neq: true } }
        { token_pk: { _is_null: false } }
        {
          _or: [
            {
              marketplace_event_type: {
                _in: [list_buy, dutch_auction_buy, english_auction_settle]
              }
            }
            { event_type: { _eq: open_edition_buy } }
          ]
        }
      ]
    }
    order_by: { id: asc }
    limit: $limit
  ) {
    id
    timestamp
    price
    creator_address
    currency {
      ...ObjktCurrencyFields
    }
    token {
      ...ObjktTokenFields
    }
  }
}
`;

export const GET_TOKEN_HOLDERS_QUERY = `
query GetTokenHolders($tokenPks: [bigint!]!, $limit: Int!, $offset: Int!) {
  token_holder(
    where: { token_pk: { _in: $tokenPks }, quantity: { _gt: "0" } }
    order_by: [{ token_pk: asc }, { holder_address: asc }]
    limit: $limit
    offset: $offset
  ) {
    token_pk
    holder_address
    quantity
  }
}
`;

export const GET_TOKEN_TRANSFERS_QUERY = `
query GetTokenTransfers($tokenPks: [bigint!]!, $since: timestamptz!, $lastId: bigint!, $limit: Int!) {
  event(
    where: {
      event_type: { _eq: transfer }
      token_pk: { _in: $tokenPks }
      timestamp: { _gte: $since }
      id: { _gt: $lastId }
      reverted: { _neq: true }
    }
    order_by: { id: asc }
    limit: $limit
  ) {
    id
    timestamp
    amount
    creator_address
    recipient_address
    token_pk
  }
}
`;
