import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

const backendRootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const logsDir = resolve(backendRootDir, 'logs');
const logPrefix = 'backend';

mkdirSync(logsDir, { recursive: true });

class DailyRollingFileStream extends Writable {
	private activeDate = '';
	private activeStream?: WriteStream;

	constructor(
		private readonly directoryPath: string,
		private readonly filePrefix: string
	) {
		super();
	}

	private resolveLogPath(date: string): string {
		return resolve(this.directoryPath, `${this.filePrefix}-${date}.log`);
	}

	private ensureStream(): WriteStream {
		const date = new Date().toISOString().slice(0, 10);
		if (!this.activeStream || this.activeDate !== date) {
			this.activeStream?.end();
			this.activeDate = date;
			this.activeStream = createWriteStream(this.resolveLogPath(date), { flags: 'a' });
		}
		return this.activeStream;
	}

	getCurrentLogPath(): string {
		const stream = this.ensureStream();
		return String(stream.path);
	}

	override _write(
		chunk: string | Buffer,
		encoding: BufferEncoding,
		callback: (error?: Error | null) => void
	): void {
		const stream = this.ensureStream();
		if (!stream.write(chunk, encoding)) {
			stream.once('drain', callback);
			return;
		}
		callback();
	}

	override _final(callback: (error?: Error | null) => void): void {
		if (!this.activeStream) {
			callback();
			return;
		}
		this.activeStream.end(() => callback());
	}
}

const destination = new DailyRollingFileStream(logsDir, logPrefix);

export const logger = pino(
	{
		level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
		timestamp: pino.stdTimeFunctions.isoTime
	},
	destination
);

export function getCurrentLogFilePath(): string {
	return destination.getCurrentLogPath();
}
