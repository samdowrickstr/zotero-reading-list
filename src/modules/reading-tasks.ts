export interface ReadingTask {
	module: string;
	unit: string;
	chapter?: string;
	pages?: string;
	paragraph?: string;
	type?: string;
	status: string;
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
	updateItemTagsFromTasks(item);
}

export function addReadingTask(item: Zotero.Item, task: ReadingTask): void {
	const tasks = getReadingTasks(item);
	tasks.push(task);
	setReadingTasks(item, tasks);
}

export function removeReadingTask(item: Zotero.Item, index: number): void {
	const tasks = getReadingTasks(item);
	if (index >= 0 && index < tasks.length) {
		tasks.splice(index, 1);
		setReadingTasks(item, tasks);
	}
}

export function updateTaskStatus(
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

export function tasksToString(tasks: ReadingTask[]): string {
	return tasks
		.map((t, idx) => {
			const details = [t.module, t.unit, t.chapter, t.pages, t.paragraph]
				.filter(Boolean)
				.join(" > ");
			const type = t.type ? ` (${t.type})` : "";
			return `${idx + 1}. ${details} [${t.status}]${type}`;
		})
		.join("\n");
}

export function updateItemTagsFromTasks(item: Zotero.Item): void {
	const tasks = getReadingTasks(item);
	const unitTags = new Set<string>();
	const moduleTags = new Set<string>();
	const typeTags = new Set<string>();
	for (const t of tasks) {
		if (t.unit) {
			unitTags.add(`Unit ${t.unit}`);
		}
		if (t.module && t.module.includes("ULAW")) {
			moduleTags.add(t.module);
		}
		if (t.type) {
			typeTags.add(t.type);
		}
	}
	const existing = item.getTags().map((t) => t.tag);
	for (const tag of existing) {
		if (/^Unit\s/.test(tag) && !unitTags.has(tag)) {
			item.removeTag(tag);
		} else if (/ULAW/.test(tag) && !moduleTags.has(tag)) {
			item.removeTag(tag);
		} else if (
			/^(Required Reading|Additional Reading)$/i.test(tag) &&
			!typeTags.has(tag)
		) {
			item.removeTag(tag);
		}
	}
	for (const tag of unitTags) {
		if (!existing.includes(tag)) {
			item.addTag(tag);
		}
	}
	for (const tag of moduleTags) {
		if (!existing.includes(tag)) {
			item.addTag(tag);
		}
	}
	for (const tag of typeTags) {
		if (!existing.includes(tag)) {
			item.addTag(tag);
		}
	}
	void item.saveTx();
}
