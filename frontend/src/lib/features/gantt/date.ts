const DAY_MS = 86_400_000;

export function toIsoDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function fromIsoDate(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(value: string, days: number): string {
	const date = fromIsoDate(value);
	date.setUTCDate(date.getUTCDate() + days);
	return toIsoDate(date);
}

export function diffDays(start: string, end: string): number {
	return Math.round((fromIsoDate(end).getTime() - fromIsoDate(start).getTime()) / DAY_MS);
}

export function isWeekend(date: Date): boolean {
	const day = date.getUTCDay();
	return day === 0 || day === 6;
}

export function formatDay(date: Date): string {
	return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}
