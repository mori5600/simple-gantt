import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getCurrentLogFilePath, logger } from './lib/logger';
import { prisma } from './models/db';

const app = createApp();
const port = Number(process.env.API_PORT ?? 8787);

serve(
	{
		fetch: app.fetch,
		port
	},
	(info) => {
		logger.info(
			{
				port: info.port,
				logFilePath: getCurrentLogFilePath()
			},
			'API server started'
		);
	}
);

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
	logger.info({ signal }, 'Shutdown signal received');
	await prisma.$disconnect();
	logger.info('Database connection closed');
	process.exit(0);
};

process.on('SIGINT', () => {
	void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
	void shutdown('SIGTERM');
});
