export interface ReadingTask {
	module: string;
	unit: string;
	type: "chapter" | "pages" | "paragraph";
	value: string;
	status: string;
}

const READING_TASKS_EXTRA_FIELD = "Reading_Tasks";
export const READING_TASK_MODULES_PREF = "reading-task-modules";

import { getPref, setPref } from "../utils/prefs";

import {
	getItemExtraProperty,
	setItemExtraProperty,
} from "../utils/extraField";

export function getStoredModuleNames(): string[] {
	const pref = getPref(READING_TASK_MODULES_PREF);
	if (typeof pref == "string" && pref.length) {
		return pref.split(";").filter((n) => n.length);
	}
	return [];
}

export function storeModuleName(name: string): void {
	const trimmed = name.trim();
	if (!trimmed) {
		return;
	}
	const modules = getStoredModuleNames();
	if (!modules.includes(trimmed)) {
		modules.push(trimmed);
		setPref(READING_TASK_MODULES_PREF, modules.join(";"));
	}
}

export function getReadingTasks(item: Zotero.Item): ReadingTask[] {
	const extra = getItemExtraProperty(item, READING_TASKS_EXTRA_FIELD);
	if (extra.length) {
		try {
			const tasks = JSON.parse(extra[0]) as any[];
			return tasks.map((t) => {
				const task = t as Partial<ReadingTask> & {
					done?: boolean;
				};
				return {
					module: task.module || "",
					unit: task.unit || "",
					type: task.type as "chapter" | "pages" | "paragraph",
					value: task.value || "",
					status: task.status ?? (task.done ? "Read" : "To Read"),
				} as ReadingTask;
			});
		} catch {
			return [];
		}
	}
	return [];
}

export function setReadingTasks(item: Zotero.Item, tasks: ReadingTask[]): void {
	setItemExtraProperty(
		item,
		READING_TASKS_EXTRA_FIELD,
		JSON.stringify(tasks),
	);
	void item.saveTx();
}

export function addReadingTask(item: Zotero.Item, task: ReadingTask): void {
	const tasks = getReadingTasks(item);
	tasks.push(task);
	setReadingTasks(item, tasks);
}

export function setTaskStatus(
	item: Zotero.Item,
	index: number,
	status: string,
): void {
	const tasks = getReadingTasks(item);
	if (tasks[index]) {
		tasks[index].status = status;
		setReadingTasks(item, tasks);
	}
}

export function removeReadingTask(item: Zotero.Item, index: number): void {
	const tasks = getReadingTasks(item);
	if (tasks[index]) {
		tasks.splice(index, 1);
		setReadingTasks(item, tasks);
	}
}

export function tasksToString(tasks: ReadingTask[]): string {
	return tasks
		.map((t, idx) => {
			const valueLabel = t.type.charAt(0).toUpperCase() + t.type.slice(1);
			const details = [t.module, t.unit, `${valueLabel}: ${t.value}`]
				.filter(Boolean)
				.join(" > ");
			return `${idx + 1}. ${details} - ${t.status}`;
		})
		.join("\n");
}

export function aggregateStatusFromTasks(
	tasks: ReadingTask[],
	statusNames: string[],
): string | undefined {
	const indexes = tasks
		.map((t) => statusNames.indexOf(t.status))
		.filter((i) => i >= 0);
	if (!indexes.length) {
		return undefined;
	}
	const minIdx = Math.min(...indexes);
	return statusNames[minIdx];
}

export function computeItemStatus(
	item: Zotero.Item,
	statusNames: string[],
): string | undefined {
	const tasks = getReadingTasks(item);
	return aggregateStatusFromTasks(tasks, statusNames);
}
