import prismaClientPackage from '@prisma/client';

const { PrismaClient } = prismaClientPackage;

const prisma = new PrismaClient();
const DAY_MS = 86_400_000;

function toIsoDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number): string {
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setTime(date.getTime() + days * DAY_MS);
	return toIsoDate(date);
}

async function main(): Promise<void> {
	const today = toIsoDate(new Date());

	await prisma.taskAssignee.deleteMany();
	await prisma.task.deleteMany();
	await prisma.project.deleteMany();
	await prisma.user.deleteMany();

	await prisma.project.createMany({
		data: [
			{ id: 'project-default', name: 'Default Project', sortOrder: 0 },
			{ id: 'project-mobile', name: 'Mobile App', sortOrder: 1 }
		]
	});

	await prisma.user.createMany({
		data: [
			{ id: 'user-ito', name: '伊藤' },
			{ id: 'user-sato', name: '佐藤' },
			{ id: 'user-yamada', name: '山田' },
			{ id: 'user-suzuki', name: '鈴木' }
		]
	});

	const tasks = [
		{
			id: 'task-discovery',
			projectId: 'project-default',
			title: '要件確認',
			note: '初回ヒアリングのメモを整理する',
			startDate: addDays(today, -2),
			endDate: addDays(today, 1),
			progress: 100,
			sortOrder: 0,
			predecessorTaskId: null,
			assigneeIds: ['user-ito']
		},
		{
			id: 'task-ui',
			projectId: 'project-default',
			title: 'UI実装',
			note: '',
			startDate: addDays(today, 1),
			endDate: addDays(today, 4),
			progress: 40,
			sortOrder: 1,
			predecessorTaskId: 'task-discovery',
			assigneeIds: ['user-sato', 'user-yamada']
		},
		{
			id: 'task-api',
			projectId: 'project-mobile',
			title: 'API接続',
			note: '',
			startDate: addDays(today, 1),
			endDate: addDays(today, 5),
			progress: 20,
			sortOrder: 0,
			predecessorTaskId: null,
			assigneeIds: ['user-yamada']
		},
		{
			id: 'task-check',
			projectId: 'project-mobile',
			title: '結合確認',
			note: '',
			startDate: addDays(today, 5),
			endDate: addDays(today, 7),
			progress: 0,
			sortOrder: 1,
			predecessorTaskId: 'task-api',
			assigneeIds: ['user-suzuki']
		}
	] as const;

	for (const task of tasks) {
		await prisma.task.create({
			data: {
				id: task.id,
				projectId: task.projectId,
				title: task.title,
				note: task.note,
				startDate: task.startDate,
				endDate: task.endDate,
				progress: task.progress,
				sortOrder: task.sortOrder,
				predecessorTaskId: task.predecessorTaskId
			}
		});

		if (task.assigneeIds.length > 0) {
			await prisma.taskAssignee.createMany({
				data: task.assigneeIds.map((userId) => ({
					taskId: task.id,
					userId
				}))
			});
		}
	}
}

void main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
