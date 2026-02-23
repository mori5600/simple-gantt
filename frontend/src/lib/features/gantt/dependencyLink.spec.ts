import { describe, expect, it } from 'vitest';
import { buildDependencyPath } from './dependencyLink';

describe('buildDependencyPath', () => {
	it('should build a simple elbow when enough horizontal space exists', () => {
		expect(
			buildDependencyPath({
				fromX: 80,
				toX: 140,
				fromY: 24,
				toY: 72,
				rowHeight: 48,
				bendOffset: 14
			})
		).toBe('M 80 24 L 126 24 L 126 72 L 140 72');
	});

	it('should detour through row boundary when bars are too close', () => {
		expect(
			buildDependencyPath({
				fromX: 140,
				toX: 150,
				fromY: 24,
				toY: 72,
				rowHeight: 48,
				bendOffset: 14
			})
		).toBe('M 140 24 L 154 24 L 154 48 L 136 48 L 136 72 L 150 72');
	});

	it('should detour upward when successor row is above', () => {
		expect(
			buildDependencyPath({
				fromX: 140,
				toX: 150,
				fromY: 120,
				toY: 72,
				rowHeight: 48,
				bendOffset: 14
			})
		).toBe('M 140 120 L 154 120 L 154 96 L 136 96 L 136 72 L 150 72');
	});
});
