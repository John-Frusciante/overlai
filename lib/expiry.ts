import type { ExpiryAlert, ItemForm, StockItem } from './types';

/**
 * 使用期限・開封後の酸化目安 — 企画書 §4 ①
 *
 * 市販薬の期限だけでなく、コスメの開封後の目安も扱う。
 * 「使い切らないまま期限を迎える」損失を減らすことがねらい（企画書 §9-3）。
 */

/** 開封後の目安（月）。断定ではなく一般的な目安として提示する */
const OPENED_MONTHS: Partial<Record<ItemForm, number>> = {
  オイル: 3,
  美容液: 3,
  軟膏: 3,
  ローション: 6,
  化粧水: 6,
  乳液: 6,
  クリーム: 6,
  導入液: 6,
  洗顔: 12,
  シャンプー: 12,
  トリートメント: 12,
  ボディソープ: 12,
};

const SOON_DAYS = 30;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function levelOf(daysLeft: number): ExpiryAlert['level'] {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= SOON_DAYS) return 'soon';
  return 'ok';
}

/** 1アイテムの期限アラートを求める。該当なしなら null */
export function alertFor(item: StockItem, today = new Date()): ExpiryAlert | null {
  // 使用期限が明示されていればそちらを優先する
  if (item.expiresAt) {
    const daysLeft = daysBetween(today, new Date(item.expiresAt));
    const level = levelOf(daysLeft);
    if (level !== 'ok') {
      return {
        itemId: item.id,
        itemName: item.name,
        kind: '使用期限',
        daysLeft,
        level,
        message:
          daysLeft < 0
            ? `使用期限を${-daysLeft}日過ぎています`
            : `使用期限まであと${daysLeft}日です`,
      };
    }
  }

  if (item.openedAt) {
    const months = OPENED_MONTHS[item.form];
    if (months === undefined) return null;
    const limit = new Date(item.openedAt);
    limit.setMonth(limit.getMonth() + months);
    const daysLeft = daysBetween(today, limit);
    const level = levelOf(daysLeft);
    if (level !== 'ok') {
      return {
        itemId: item.id,
        itemName: item.name,
        kind: '開封後の目安',
        daysLeft,
        level,
        message:
          daysLeft < 0
            ? `開封から${months}ヶ月の目安を過ぎています。品質が変わっている可能性があります`
            : `開封から${months}ヶ月の目安まであと${daysLeft}日です`,
      };
    }
  }

  return null;
}

/** 在庫全体のアラート。期限が近いものから並べる */
export function collectAlerts(stock: StockItem[], today = new Date()): ExpiryAlert[] {
  return stock
    .map((i) => alertFor(i, today))
    .filter((a): a is ExpiryAlert => a !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** 残量が少ないアイテム（服薬記録で減っていく） */
export function lowStock(stock: StockItem[], threshold = 5): StockItem[] {
  return stock.filter((i) => i.remaining !== undefined && i.remaining.count <= threshold);
}
