export interface ReadingTask {
	module: string;
	unit: string;
	type: "chapter" | "pages" | "paragraph";
	value: string;
	done?: boolean;
}

const READING_TASKS_EXTRA_FIELD = "Reading_Tasks";

import {
	getItemExtraProperty,
	setItemExtraProperty,
} from "../utils/extraField";

export function getReadingTasks(item: Zotero.Item): ReadingTask[] {
	const extra = getItemExtraProperty(item, READING_TASKS_EXTRA_FIELD);
	if (extra.length) {
		try {
			return JSON.parse(extra[0]) as ReadingTask[];
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

export function toggleTaskDone(item: Zotero.Item, index: number): void {
	const tasks = getReadingTasks(item);
	if (tasks[index]) {
		tasks[index].done = !tasks[index].done;
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
			const status = t.done ? "✔" : "✘";
			return `${idx + 1}. ${details} - ${status}`;
		})
		.join("\n");
}
