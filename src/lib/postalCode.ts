/**
 * 郵便番号から住所を検索するユーティリティ
 * API: zipcloud (https://zipcloud.ibsnet.co.jp)
 * - 無料・APIキー不要
 * - 7桁の郵便番号から都道府県・市区町村・町域を返す
 */

interface ZipcloudResult {
  address1: string; // 都道府県
  address2: string; // 市区町村
  address3: string; // 町域
}

interface ZipcloudResponse {
  status: number;
  message: string | null;
  results: ZipcloudResult[] | null;
}

/**
 * 郵便番号（ハイフンあり・なし両対応）から住所文字列を返す
 * 見つからない場合は null を返す
 */
export async function lookupAddressByPostalCode(
  postalCode: string
): Promise<string | null> {
  // 数字のみ抽出
  const digits = postalCode.replace(/[^0-9]/g, "");
  if (digits.length !== 7) return null;

  try {
    const res = await fetch(
      `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`,
      { cache: "force-cache" } // 同じ郵便番号は再リクエストしない
    );
    if (!res.ok) return null;

    const data: ZipcloudResponse = await res.json();
    if (data.status !== 200 || !data.results || data.results.length === 0) {
      return null;
    }

    const r = data.results[0];
    // 例: "東京都港区南青山"
    return `${r.address1}${r.address2}${r.address3}`;
  } catch {
    return null;
  }
}
