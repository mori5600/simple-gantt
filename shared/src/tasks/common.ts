import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

export const isoDateSchema = z
	.string()
	.regex(ISO_DATE_REGEX, 'YYYY-MM-DD 形式で入力してください。')
	.refine(isIsoDate, '存在しない日付です。');

export const isoDateTimeSchema = z.string().datetime({ offset: true });
