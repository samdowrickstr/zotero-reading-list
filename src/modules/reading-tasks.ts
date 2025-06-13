export interface ReadingTask {
	module: string;
	unit: string;
	chapter?: string;
	pages?: string;
	paragraph?: string;
	type?: string;
	status: string;
}

import { getTasksFromNote, saveTasksToNote } from "../utils/noteHelpers";

export function sortTasks(tasks: ReadingTask[]): ReadingTask[] {
	return tasks.slice().sort((a, b) => {
		const mod = (a.module || "").localeCompare(b.module || "", undefined, {
			numeric: true,
			sensitivity: "base",
		});
		if (mod !== 0) {
			return mod;
		}
		const unit = (a.unit || "").localeCompare(b.unit || "", undefined, {
			numeric: true,
			sensitivity: "base",
		});
		if (unit !== 0) {
			return unit;
		}
		const typeWeight = (t: string | undefined) => {
			if (!t) return 0;
			const lower = t.toLowerCase();
			if (lower === "required" || lower === "core") return 0;
			if (lower === "additional") return 1;
			return 2;
		};
		return typeWeight(a.type) - typeWeight(b.type);
	});
}

export function getReadingTasks(item: Zotero.Item): ReadingTask[] {
	const content = getTasksFromNote(item);
	if (content) {
		try {
			const tasks = JSON.parse(content) as ReadingTask[];
			return sortTasks(tasks);
		} catch {
			return [];
		}
	}
	return [];
}

export function setReadingTasks(item: Zotero.Item, tasks: ReadingTask[]): void {
	const sorted = sortTasks(tasks);
	saveTasksToNote(item, JSON.stringify(sorted));
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
			const unit = t.unit ? `Unit ${t.unit}` : undefined;
			const details = [t.module, unit, t.chapter, t.pages, t.paragraph]
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
			// Convert required/additional types into longer tag names
			if (/^Required$/i.test(t.type)) {
				typeTags.add("Required Reading");
			} else if (/^Additional$/i.test(t.type)) {
				typeTags.add("Additional Reading");
			} else {
				typeTags.add(t.type);
			}
		}
	}

	const existing = item.getTags().map((t) => t.tag);
	for (const tag of existing) {
		if (/^Unit\s/.test(tag) && !unitTags.has(tag)) {
			item.removeTag(tag);
		} else if (/ULAW/.test(tag) && !moduleTags.has(tag)) {
			item.removeTag(tag);
		} else if (
			/^(Required Reading|Additional Reading|Required|Additional)$/i.test(
				tag,
			) &&
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
