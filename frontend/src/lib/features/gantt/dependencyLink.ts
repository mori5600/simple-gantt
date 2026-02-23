type BuildDependencyPathInput = {
	fromX: number;
	toX: number;
	fromY: number;
	toY: number;
	rowHeight: number;
	bendOffset: number;
};

export function buildDependencyPath({
	fromX,
	toX,
	fromY,
	toY,
	rowHeight,
	bendOffset
}: BuildDependencyPathInput): string {
	const escapeX = fromX + bendOffset;
	const approachX = toX - bendOffset;

	// If enough horizontal room exists, use the simple 3-segment elbow.
	if (escapeX <= approachX || fromY === toY) {
		const bendX = Math.max(escapeX, approachX);
		return `M ${fromX} ${fromY} L ${bendX} ${fromY} L ${bendX} ${toY} L ${toX} ${toY}`;
	}

	// For close bars, detour to the row boundary first so the link does not vanish under task bars.
	const direction = toY > fromY ? 1 : -1;
	const detourY = fromY + direction * (rowHeight / 2);

	return [
		`M ${fromX} ${fromY}`,
		`L ${escapeX} ${fromY}`,
		`L ${escapeX} ${detourY}`,
		`L ${approachX} ${detourY}`,
		`L ${approachX} ${toY}`,
		`L ${toX} ${toY}`
	].join(' ');
}
