export enum ActivityType {
  Transaction = "Transaction",
  BakerRewards = "BakerRewards",
  CollectibleSold = "CollectibleSold",
  CollectiblePurchased = "CollectiblePurchased",
  CollectibleResold = "CollectibleResold",
  CollectibleSellOffer = "CollectibleSellOffer",
  BidMade = "BidMade",
  BidReceived = "BidReceived",
  BidOutbited = "BidOutbited",
}

export enum StatusType {
  New = "New",
  Read = "Read",
  Viewed = "Viewed",
}

export interface ActivityNotification {
  id: string;
  createdAt: string;
  status: StatusType;
  type: ActivityType;
  title: string;
  description: string;
}

export interface TransactionActivityNotification extends ActivityNotification {
  type: ActivityType.Transaction;
  transactionHash: string;
}

export interface BakerRewardsActivityNotification extends ActivityNotification {
  type: ActivityType.BakerRewards;
  transactionHash: string;
  rewardAmount: string;
  rewardLuck: string;
}

export interface CollectibleSoldActivityNotification extends ActivityNotification {
  type: ActivityType.CollectibleSold;
  collectibleName: string;
  collectibleMarketplaceUrl: string;
  transactionAmount: string;
  buyerAddress: string;
  creatorName: string;
  creatorMarketplaceUrl: string;
  marketplaceUrl: string;
}

export interface CollectiblePurchasedActivityNotification extends ActivityNotification {
  type: ActivityType.CollectiblePurchased;
  collectibleName: string;
  collectibleMarketplaceUrl: string;
  transactionAmount: string;
  sellerAddress: string;
  creatorName: string;
  creatorMarketplaceUrl: string;
  marketplaceUrl: string;
}

export interface CollectibleResoldActivityNotification extends ActivityNotification {
  type: ActivityType.CollectibleResold;
  collectibleName: string;
  collectibleMarketplaceUrl: string;
  royaltyAmount: string;
  buyerAddress: string;
  sellerAddress: string;
  creatorName: string;
  creatorMarketplaceUrl: string;
  marketplaceUrl: string;
}

export interface CollectibleSellOfferActivityNotification extends ActivityNotification {
  type: ActivityType.CollectibleSellOffer;
  collectibleName: string;
  collectibleMarketplaceUrl: string;
  offerAmount: string;
  offerAddress: string;
  creatorName: string;
  creatorMarketplaceUrl: string;
  marketplaceUrl: string;
}

export interface BidMadeActivityNotification extends ActivityNotification {
  type: ActivityType.BidMade;
  bidAmount: string;
  actionName: string;
  actionUrl: string;
  marketplaceUrl: string;
}

export interface BidReceivedActivityNotification extends ActivityNotification {
  type: ActivityType.BidReceived;
  bidAmount: string;
  actionName: string;
  actionUrl: string;
  bidderAddress: string;
  marketplaceUrl: string;
}

export interface BidOutbitedActivityNotification extends ActivityNotification {
  type: ActivityType.BidOutbited;
  bidAmount: string;
  actionName: string;
  actionUrl: string;
  bidderAddress: string;
  topBidAmount: string;
  marketplaceUrl: string;
}