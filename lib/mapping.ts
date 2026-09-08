import type { ItemForm, ProductCategory, ProductForm, StockCategory } from './types';

/**
 * 店頭商品の分類（ProductCategory / ProductForm）を
 * 自宅在庫の分類（StockCategory / ItemForm）へ変換する。
 *
 * 両者は別軸であり値が一致しないのは意図的なので、キャストではなく明示的に対応づける。
 * 店頭商品に処方薬は存在しないため、処方系のカテゴリへは決して変換されない。
 */

export function toStockCategory(c: ProductCategory): StockCategory {
  switch (c) {
    case '市販薬':
    case 'サプリ':
      return '市販薬・サプリ';
    case 'スキンケア':
      return 'スキンケア';
    case 'ヘアケア':
      return 'ヘアケア';
    default:
      return '市販薬・サプリ';
  }
}

export function toItemForm(f: ProductForm): ItemForm {
  switch (f) {
    case '錠剤':
    case 'カプセル':
    case '化粧水':
    case '乳液':
    case 'クリーム':
    case '軟膏':
    case 'シャンプー':
      return f;
    default:
      return 'その他';
  }
}
