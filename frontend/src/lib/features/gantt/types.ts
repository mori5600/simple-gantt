export type ZoomLevel = 'day' | 'week' | 'month';

export type TaskCompletionFilter = 'all' | 'incomplete' | 'complete';

export type ListColumnWidths = [number, number, number, number, number];

export type TaskDateRange = {
	startDate: string;
	endDate: string;
};
