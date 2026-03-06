import { base } from '$app/paths';
import { HTTP_STATUS } from '@simple-gantt/shared/http-status';
import { redirect } from '@sveltejs/kit';

export function load(): never {
	throw redirect(HTTP_STATUS.PERMANENT_REDIRECT, `${base}/admin/projects`);
}
