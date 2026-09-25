import { describe, expect, it } from 'vitest';

import { ObjktOfferReceived, ObjktToken } from '../utils/objkt';

import { OBJKT_NOTIFICATION_IMAGE_URL } from './default-image-fallbacks';
import { mapObjktEventsToAccountNotifications } from './from-objkt-events';
import { NotificationType } from './notification.interface';

const token: ObjktToken = {
  tokenId: '1',
  name: 'Tezzard',
  faContract: 'KT1abc'
};

const offer = (overrides: Partial<ObjktOfferReceived> = {}): ObjktOfferReceived => ({
  id: 42,
  timestamp: '2026-09-17T09:00:00.000Z',
  token,
  amount: 1_500_000,
  currency: { symbol: 'tez', decimals: 6 },
  holderAddresses: ['tz1holder'],
  ...overrides
});

describe('mapObjktEventsToAccountNotifications', () => {
  it('maps an offer using significant decimals, objkt copy, and the pinata icon', () => {
    const [item] = mapObjktEventsToAccountNotifications([offer()], [], []);

    expect(item).toEqual({
      accountAddresses: ['tz1holder'],
      notification: {
        id: 42,
        createdAt: '2026-09-17T09:00:00.000Z',
        type: NotificationType.OfferReceived,
        language: 'en-US',
        title: 'New offer for 1.5 tez',
        description: 'On Tezzard',
        content: ['On Tezzard'],
        extensionImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        mobileImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        sourceUrl: 'https://objkt.com/tokens/KT1abc/1'
      }
    });
  });

  it('maps auction bids and nft sales to the matching copy', () => {
    const [bidItem, saleItem] = mapObjktEventsToAccountNotifications(
      [],
      [
        {
          id: 7,
          timestamp: '2026-09-17T09:01:00.000Z',
          token,
          amount: 2_000_000,
          currency: { symbol: 'tez', decimals: 6 },
          sellerAddress: 'tz1seller'
        }
      ],
      [
        {
          id: 8,
          timestamp: '2026-09-17T09:02:00.000Z',
          token,
          amount: 3_000_000,
          currency: { symbol: 'tez', decimals: 6 },
          sellerAddress: 'tz1seller'
        }
      ]
    );

    expect(bidItem).toEqual({
      accountAddresses: ['tz1seller'],
      notification: {
        id: 7,
        createdAt: '2026-09-17T09:01:00.000Z',
        type: NotificationType.AuctionBid,
        language: 'en-US',
        title: 'New bid for 2 tez',
        description: 'On Tezzard',
        content: ['On Tezzard'],
        extensionImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        mobileImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        sourceUrl: 'https://objkt.com/tokens/KT1abc/1'
      }
    });
    expect(saleItem).toEqual({
      accountAddresses: ['tz1seller'],
      notification: {
        id: 8,
        createdAt: '2026-09-17T09:02:00.000Z',
        type: NotificationType.NftSold,
        language: 'en-US',
        title: 'NFT sold for 3 tez',
        description: 'On Tezzard',
        content: ['On Tezzard'],
        extensionImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        mobileImageUrl: OBJKT_NOTIFICATION_IMAGE_URL,
        sourceUrl: 'https://objkt.com/tokens/KT1abc/1'
      }
    });
  });

  it('skips offers without holders and bids or sales without a seller', () => {
    expect(
      mapObjktEventsToAccountNotifications(
        [offer({ holderAddresses: [] })],
        [
          {
            id: 7,
            timestamp: '2026-09-17T09:01:00.000Z',
            token,
            amount: 2_000_000,
            currency: { symbol: 'tez', decimals: 6 },
            sellerAddress: ''
          }
        ],
        [
          {
            id: 8,
            timestamp: '2026-09-17T09:02:00.000Z',
            token,
            amount: 3_000_000,
            currency: { symbol: 'tez', decimals: 6 },
            sellerAddress: ''
          }
        ]
      )
    ).toEqual([]);
  });

  it('falls back to token id, tokens symbol, and k-format for large amounts', () => {
    const [unnamed, thousands, millions, billions] = mapObjktEventsToAccountNotifications(
      [
        offer({
          id: 1,
          token: { ...token, name: null, tokenId: '99' },
          currency: null,
          amount: 5
        }),
        offer({
          id: 2,
          amount: 1_000_000_000,
          holderAddresses: ['tz1holder']
        }),
        offer({
          id: 3,
          amount: 1_000_000_000_000,
          holderAddresses: ['tz1holder']
        }),
        offer({
          id: 4,
          amount: 1_000_000_000_000_000,
          holderAddresses: ['tz1holder']
        })
      ],
      [],
      []
    );

    expect(unnamed.notification.title).toBe('New offer for 5 tokens');
    expect(unnamed.notification.description).toBe('On #99');
    expect(thousands.notification.title).toBe('New offer for 1K tez');
    expect(millions.notification.title).toBe('New offer for 1M tez');
    expect(billions.notification.title).toBe('New offer for 1B tez');
  });
});
