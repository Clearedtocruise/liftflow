import { Linking, Share } from 'react-native';

import type { GroceryList } from '@/types';

export type GroceryRetailerId =
  | 'walmart'
  | 'amazon_fresh'
  | 'instacart'
  | 'costco'
  | 'sams_club'
  | 'kroger';

export type GroceryRetailerAdapter = {
  id: GroceryRetailerId;
  displayName: string;
  /** Direct cart APIs require partner access — false until wired. */
  supportsDirectCart: false;
  openShoppingExperience: (list: GroceryList) => Promise<void>;
};

function formatListText(list: GroceryList): string {
  const lines = list.items.map((item) => {
    const qty =
      item.quantity != null
        ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
        : item.unit ?? '';
    return `• ${item.name}${qty ? ` — ${qty}` : ''}`;
  });
  return `${list.name}\n\n${lines.join('\n')}`;
}

async function openUrlOrShare(url: string, list: GroceryList): Promise<void> {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through to share
  }
  await Share.share({ message: formatListText(list), title: list.name });
}

function makeAdapter(
  id: GroceryRetailerId,
  displayName: string,
  storeUrl: string,
): GroceryRetailerAdapter {
  return {
    id,
    displayName,
    supportsDirectCart: false,
    async openShoppingExperience(list) {
      await openUrlOrShare(storeUrl, list);
    },
  };
}

export const GROCERY_RETAILERS: GroceryRetailerAdapter[] = [
  makeAdapter('walmart', 'Walmart', 'https://www.walmart.com/'),
  makeAdapter('amazon_fresh', 'Amazon Fresh', 'https://www.amazon.com/alm/storefront?almBrandId=QW1hem9uIEZyZXNo'),
  makeAdapter('instacart', 'Instacart', 'https://www.instacart.com/'),
  makeAdapter('costco', 'Costco', 'https://www.costco.com/'),
  makeAdapter('sams_club', "Sam's Club", 'https://www.samsclub.com/'),
  makeAdapter('kroger', 'Kroger', 'https://www.kroger.com/'),
];

export function getGroceryRetailer(id: GroceryRetailerId | string | null | undefined): GroceryRetailerAdapter {
  return GROCERY_RETAILERS.find((r) => r.id === id) ?? GROCERY_RETAILERS[0]!;
}

export const DEFAULT_GROCERY_RETAILER_ID: GroceryRetailerId = 'walmart';
export const GROCERY_RETAILER_PREF_KEY = 'preferredGroceryRetailer';
