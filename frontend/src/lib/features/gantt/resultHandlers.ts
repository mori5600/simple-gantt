/**
 * `kind` を持つ結果オブジェクトを種類ごとに処理するための共通ユーティリティです。
 *
 * ワークフロー結果の分岐処理を呼び出し元へ散らさず、
 * 「結果の種類ごとのハンドラ定義」に統一するために定義しています。
 */

/**
 * `kind` を判別キーとして持つ結果型です。
 */
export type KindedResult = {
	kind: string;
};

/**
 * `kind` ごとの処理関数を定義するハンドラ型です。
 */
export type ResultHandlers<TResult extends KindedResult, TReturn> = {
	[K in TResult['kind']]: (result: Extract<TResult, { kind: K }>) => TReturn;
};

/**
 * 結果オブジェクトの `kind` に対応するハンドラを実行します。
 *
 * @param result 判別対象の結果オブジェクト
 * @param handlers `kind` ごとの処理定義
 * @returns 選択されたハンドラの戻り値
 */
export function handleResultByKind<TResult extends KindedResult, TReturn>(
	result: TResult,
	handlers: ResultHandlers<TResult, TReturn>
): TReturn {
	const kind = result.kind as TResult['kind'];
	const handler = handlers[kind] as (value: TResult) => TReturn;
	return handler(result);
}
