import { AdvertisingInterface } from "./advertising.interface";

const DIGITAL_OCEAN_URL = 'https://generic-objects.fra1.digitaloceanspaces.com';

const ZEPHYR: AdvertisingInterface = {
  name: 'Zephyr',
  url: 'https://zephyr.digital/?utm_source=tezos&utm_medium=cpm&utm_campaign=tezos_ads&utm_term={zone}',
  fullPageBannerUrl: `${DIGITAL_OCEAN_URL}/banners/fullpage-banner.svg`,
  fullPageLogoUrl: `${DIGITAL_OCEAN_URL}/banners/fullpage-logo.svg`,
  popupBannerUrl: `${DIGITAL_OCEAN_URL}/banners/popup-banner.svg`,
  popupLogoUrl: `${DIGITAL_OCEAN_URL}/banners/popup-logo.svg`,
  mobileBannerUrl: `${DIGITAL_OCEAN_URL}/banners/mobile-banner.svg`
};

export const getAdvertisingInfo = (): AdvertisingInterface | undefined => undefined;
