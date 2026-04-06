"use client";

import { useState, useEffect } from "react";
import {
  CARRIER_NAMES,
  YAMATO_SIZES,
  SAGAWA_SIZES,
  SIZE_LABELS,
  ZONE_NAMES,
  PREFECTURE_ZONE,
  extractPrefecture,
  calcShippingFee,
  toTaxExclusive,
  shippingItemName,
  type Carrier,
} from "@/lib/shipping";

interface Props {
  deliveryAddress: string;
  onFeeChange?: (feeTaxInc: number) => void;
  defaultShipping?: { carrier: Carrier; size: number; feeTaxInc: number };
}

export function ShippingFeeSelector({ deliveryAddress, onFeeChange, defaultShipping }: Props) {
  const [enabled,      setEnabled]      = useState(!!defaultShipping);
  const [carrier,      setCarrier]      = useState<Carrier>(defaultShipping?.carrier ?? "yamato");
  const [size,         setSize]         = useState<number>(defaultShipping?.size ?? 80);
  const [isManual,     setIsManual]     = useState(false);
  const [manualAmount, setManualAmount] = useState("");

  // 住所から都道府県を抽出
  const prefecture = extractPrefecture(deliveryAddress);
  const zone       = prefecture !== null ? PREFECTURE_ZONE[prefecture] : undefined;
  const zoneName   = zone !== undefined ? ZONE_NAMES[zone] : null;

  // 自動計算料金
  const calcFee = (prefecture !== null)
    ? calcShippingFee(carrier, size, prefecture)
    : undefined;

  // 実効料金
  const effectiveFee = isManual ? (parseInt(manualAmount) || 0) : (calcFee ?? 0);

  // 税抜価格
  const unitPrice = Math.floor(effectiveFee / 1.1);

  // キャリアを切り替えたときにサイズを調整
  useEffect(() => {
    if (carrier === "sagawa" && size === 170) {
      setSize(160);
    }
  }, [carrier, size]);

  // 初期マウント時にdefaultShippingがあれば手動モードを判定
  useEffect(() => {
    if (defaultShipping) {
      const initialCalcFee = (prefecture !== null)
        ? calcShippingFee(defaultShipping.carrier, defaultShipping.size, prefecture)
        : undefined;
      if (initialCalcFee !== defaultShipping.feeTaxInc) {
        setIsManual(true);
        setManualAmount(String(defaultShipping.feeTaxInc));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // onFeeChangeを通知
  useEffect(() => {
    if (onFeeChange) onFeeChange(enabled ? effectiveFee : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, effectiveFee]);

  const sizes = carrier === "yamato" ? YAMATO_SIZES : SAGAWA_SIZES;

  return (
    <section className="card overflow-hidden">
      {/* ── ヘッダー（トグル） ── */}
      <label className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 accent-brand-600"
        />
        <div>
          <p className="text-sm font-semibold text-gray-700">配送料を追加する</p>
          {!enabled && (
            <p className="text-xs text-gray-400 mt-0.5">
              ヤマト運輸・佐川急便の配送料を自動計算して明細に追加します
            </p>
          )}
        </div>
      </label>

      {/* ── 展開パネル ── */}
      {enabled && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">

          {/* 配送会社 */}
          <div>
            <p className="label mb-2">配送会社</p>
            <div className="grid grid-cols-2 gap-2">
              {(["yamato", "sagawa"] as Carrier[]).map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                    carrier === c
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    value={c}
                    checked={carrier === c}
                    onChange={() => setCarrier(c)}
                    className="accent-brand-600"
                  />
                  <span className="font-medium text-sm text-gray-800">
                    {c === "yamato" ? "🚀" : "🚛"} {CARRIER_NAMES[c]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 配送サイズ */}
          <div>
            <label className="label" htmlFor="shipping_size_select">
              配送サイズ（3辺合計）
            </label>
            <select
              id="shipping_size_select"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="input"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* お届け先ゾーン表示 */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1.5 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 w-20 flex-shrink-0">発送元</span>
              <span className="text-gray-700 font-medium">東京都港区南青山7-12-9</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 w-20 flex-shrink-0">お届け先</span>
              {prefecture ? (
                <span className="text-gray-700 font-medium">
                  {prefecture}
                  {zoneName && (
                    <span className="ml-2 text-xs text-gray-400">({zoneName})</span>
                  )}
                </span>
              ) : (
                <span className="text-amber-600 text-xs font-medium">
                  ⚠ お届け先住所から都道府県を取得できません。住所を入力してください。
                </span>
              )}
            </div>
          </div>

          {/* 料金表示 */}
          {!isManual && calcFee !== undefined && calcFee !== null ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium mb-0.5">自動計算された配送料</p>
                  <p className="text-sm text-green-700 font-medium">
                    {CARRIER_NAMES[carrier]}　{size}サイズ
                  </p>
                  <p className="text-xs text-green-500 mt-0.5">
                    {prefecture} 宛・参考料金（税込）
                  </p>
                </div>
                <p className="text-3xl font-black text-green-800">
                  ¥{calcFee.toLocaleString("ja-JP")}
                </p>
              </div>
              <div className="mt-3 border-t border-green-100 pt-2 flex items-center justify-between">
                <p className="text-xs text-green-400">
                  ※ 表示金額は参考値です。実際の料金はご利用会社の公式料金でご確認ください。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(true);
                    setManualAmount(String(calcFee));
                  }}
                  className="text-xs text-green-600 hover:text-green-800 underline underline-offset-2 flex-shrink-0 ml-3"
                >
                  金額を手動で変更する
                </button>
              </div>
            </div>
          ) : isManual ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium">配送料（税込・手動入力）</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsManual(false);
                    setManualAmount("");
                  }}
                  className="text-xs text-brand-600 hover:text-brand-800 underline underline-offset-2"
                >
                  自動計算に戻す
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">¥</span>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="例: 1650"
                  min={0}
                  className="input flex-1"
                />
                <span className="text-xs text-gray-400">税込</span>
              </div>
            </div>
          ) : prefecture ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              この都道府県の料金データが見つかりません。
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              ⚠ お届け先住所を入力すると配送料を自動計算します。
            </div>
          )}

          {/* hidden inputs（Server Actionに渡す） */}
          <input type="hidden" name="shipping_enabled"    value="true" />
          <input type="hidden" name="shipping_carrier"    value={carrier} />
          <input type="hidden" name="shipping_size"       value={String(size)} />
          <input type="hidden" name="shipping_fee_total"  value={String(effectiveFee)} />
          <input type="hidden" name="shipping_unit_price" value={String(unitPrice)} />
          <input type="hidden" name="shipping_item_name"  value={shippingItemName(carrier, size)} />
        </div>
      )}
    </section>
  );
}
