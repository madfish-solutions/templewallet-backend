import BigNumber from 'bignumber.js';

import { isDefined, isNonEmptyString } from '../utils/helpers';
import { ObjktAuctionBid, ObjktCurrency, ObjktNftSold, ObjktOfferReceived, ObjktToken } from '../utils/objkt';

import { AccountNotificationInput } from './add-account-notifications';
import { OBJKT_NOTIFICATION_IMAGE_URL } from './default-image-fallbacks';
import { NotificationType } from './notification.interface';

const THOUSAND = 1_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;
const FULL_DECIMALS_AMOUNT_LIMIT = 120;

const kFormatter = (num: number): string => {
  if (Number.isNaN(num)) {
    return '';
  }

  const sign = Math.sign(num);
  const formattedValue = Math.abs(num);

  if (formattedValue >= BILLION) {
    return (sign * Math.round(formattedValue / BILLION)).toLocaleString('en-US') + 'B';
  }

  if (formattedValue >= MILLION) {
    return (sign * Math.round(formattedValue / MILLION)).toLocaleString('en-US') + 'M';
  }

  if (formattedValue >= THOUSAND) {
    return (sign * Math.round(formattedValue / THOUSAND)).toLocaleString('en-US') + 'K';
  }

  return (sign * formattedValue).toLocaleString('en-US');
};

const formatObjktAmount = (amount: number, currency: ObjktCurrency | null) => {
  const decimals = currency?.decimals ?? 0;
  const symbol = currency?.symbol;
  const value = new BigNumber(amount).shiftedBy(-decimals);
  const formattedAmount = value.abs().lt(FULL_DECIMALS_AMOUNT_LIMIT) ? value.toFixed() : kFormatter(value.toNumber());

  return `${formattedAmount} ${isNonEmptyString(symbol) ? symbol : 'tokens'}`;
};

const getNftName = (token: ObjktToken) => (isNonEmptyString(token.name) ? token.name : `#${token.tokenId}`);

const getObjktTokenUrl = (token: ObjktToken) => `https://objkt.com/tokens/${token.faContract}/${token.tokenId}`;

const createObjktNotification = ({
  id,
  createdAt,
  type,
  title,
  description,
  token
}: {
  id: number;
  createdAt: string;
  type: AccountNotificationInput['notification']['type'];
  title: string;
  description: string;
  token: ObjktToken;
}): AccountNotificationInput['notification'] => {
  const sourceUrl = getObjktTokenUrl(token);

  return {
    id,
    createdAt,
    type,
    language: 'en-US',
    title,
    description,
    content: [description],
    extensionImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
    mobileImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
    sourceUrl
  };
};

const mapObjktOfferToNotification = (offer: ObjktOfferReceived): AccountNotificationInput | undefined => {
  if (offer.holderAddresses.length === 0) {
    return undefined;
  }

  const nftName = getNftName(offer.token);
  const amount = formatObjktAmount(offer.amount, offer.currency);

  return {
    notification: createObjktNotification({
      id: offer.id,
      createdAt: offer.timestamp,
      type: NotificationType.OfferReceived,
      title: `New offer for ${amount}`,
      description: `On ${nftName}`,
      token: offer.token
    }),
    accountAddresses: offer.holderAddresses
  };
};

const mapObjktAuctionBidToNotification = (bid: ObjktAuctionBid): AccountNotificationInput | undefined => {
  if (!isNonEmptyString(bid.sellerAddress)) {
    return undefined;
  }

  const nftName = getNftName(bid.token);
  const amount = formatObjktAmount(bid.amount, bid.currency);

  return {
    notification: createObjktNotification({
      id: bid.id,
      createdAt: bid.timestamp,
      type: NotificationType.AuctionBid,
      title: `New bid for ${amount}`,
      description: `On ${nftName}`,
      token: bid.token
    }),
    accountAddresses: [bid.sellerAddress]
  };
};

const mapObjktNftSoldToNotification = (sale: ObjktNftSold): AccountNotificationInput | undefined => {
  if (!isNonEmptyString(sale.sellerAddress)) {
    return undefined;
  }

  const nftName = getNftName(sale.token);
  const amount = formatObjktAmount(sale.amount, sale.currency);

  return {
    notification: createObjktNotification({
      id: sale.id,
      createdAt: sale.timestamp,
      type: NotificationType.NftSold,
      title: `NFT sold for ${amount}`,
      description: `On ${nftName}`,
      token: sale.token
    }),
    accountAddresses: [sale.sellerAddress]
  };
};

export const mapObjktEventsToAccountNotifications = (
  offers: ObjktOfferReceived[],
  bids: ObjktAuctionBid[],
  sales: ObjktNftSold[]
): AccountNotificationInput[] =>
  offers
    .map(mapObjktOfferToNotification)
    .concat(bids.map(mapObjktAuctionBidToNotification), sales.map(mapObjktNftSoldToNotification))
    .filter(isDefined);
