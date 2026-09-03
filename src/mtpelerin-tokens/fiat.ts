import { HTMLElement } from 'node-html-parser';
import * as yup from 'yup';

import { isDefined } from '../utils/helpers';

import { mtPelerinCurrenciesUrl } from './common';

const mtPelerinFiatCurrencyEntrySchema = yup
  .object({
    iconPath: yup.string().required(),
    symbol: yup.string().required(),
    name: yup.string().required(),
    buySupportCell: yup.mixed<HTMLElement>().required(),
    sellSupportCell: yup.mixed<HTMLElement>().required()
  })
  .required();

export interface MtPelerinFiatCurrency {
  iconUrl: string;
  symbol: string;
  name: string;
  isBuySupported: boolean;
  isSellSupported: boolean;
}

const hasSupportIcon = (cell: HTMLElement) => {
  const icon = cell.querySelector('img');
  const iconPath = icon?.attributes['data-src'] ?? icon?.attributes.src;
  const iconName = iconPath?.split('/').pop()?.toLowerCase();

  return Boolean(iconName?.includes('check'));
};

export const parseFiatCurrencies = (root: HTMLElement): MtPelerinFiatCurrency[] => {
  const currenciesTable = root
    .querySelectorAll('#currencieslist')
    .find(table => table.querySelectorAll('th').some(header => header.text.trim() === 'Buy in'));

  if (currenciesTable === undefined) {
    throw new Error('Fiat currencies table is missing');
  }

  const currencies: MtPelerinFiatCurrency[] = [];

  for (const row of currenciesTable.querySelectorAll('tr')) {
    const [iconCell, symbolCell, nameCell, buySupportCell, sellSupportCell] = row.querySelectorAll('td');
    const currencyIcon = iconCell?.querySelector('img.currency-icon');

    if (!isDefined(currencyIcon)) {
      continue;
    }

    const currency = mtPelerinFiatCurrencyEntrySchema.validateSync({
      iconPath: currencyIcon.attributes['data-src'] ?? currencyIcon.attributes.src,
      symbol: symbolCell?.text.trim(),
      name: nameCell?.text.trim(),
      buySupportCell,
      sellSupportCell
    });

    currencies.push({
      iconUrl: new URL(currency.iconPath, mtPelerinCurrenciesUrl).toString(),
      symbol: currency.symbol,
      name: currency.name,
      isBuySupported: hasSupportIcon(currency.buySupportCell),
      isSellSupported: hasSupportIcon(currency.sellSupportCell)
    });
  }

  if (currencies.length === 0) {
    throw new Error('Fiat currencies list is empty');
  }

  return currencies;
};
