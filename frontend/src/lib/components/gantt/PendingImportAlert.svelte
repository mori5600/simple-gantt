<script lang="ts">
	type Props = {
		fileName: string;
		missingAssigneeNames: string[];
		isImporting: boolean;
		onContinue: () => void;
		onCancel: () => void;
	};

	let { fileName, missingAssigneeNames, isImporting, onContinue, onCancel }: Props = $props();
</script>

<div class="border-y border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
	<p class="font-semibold">未登録担当者が見つかりました ({missingAssigneeNames.length} 名)</p>
	<p class="mt-1">
		{fileName || '取込ファイル'} に未登録担当者が含まれています。ユーザーを作成して続行しますか？
	</p>
	<p class="mt-1 wrap-break-word">{missingAssigneeNames.join(', ')}</p>
	<div class="mt-3 flex flex-wrap gap-2">
		<button
			type="button"
			class="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
			onclick={onContinue}
			disabled={isImporting}
		>
			不足ユーザーを作成して続行
		</button>
		<button
			type="button"
			class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
			onclick={onCancel}
			disabled={isImporting}
		>
			キャンセル
		</button>
	</div>
</div>
