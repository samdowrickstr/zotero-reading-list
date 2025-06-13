export const READING_LIST_NOTE_MARKER = "ReadingListTasks";
const TITLE_SEP = ":";

function getItemTitle(item: Zotero.Item): string {
	const fields = ["title", "caseName", "nameOfAct", "shortTitle"];
	for (const field of fields) {
		const val = item.getField(field as any);
		if (val) {
			return val;
		}
	}
	return "";
}

function encodeContent(title: string, tasks: string): string {
	return `${READING_LIST_NOTE_MARKER}${TITLE_SEP}${title}\n${tasks}`;
}

function decodeContent(content: string): {
	title: string | null;
	tasks: string;
} {
	const firstNewline = content.indexOf("\n");
	let firstLine = content;
	let rest = "";
	if (firstNewline !== -1) {
		firstLine = content.slice(0, firstNewline);
		rest = content.slice(firstNewline + 1);
	}
	if (firstLine.startsWith(`${READING_LIST_NOTE_MARKER}${TITLE_SEP}`)) {
		const title = firstLine.slice(
			READING_LIST_NOTE_MARKER.length + TITLE_SEP.length,
		);
		return { title, tasks: rest };
	}
	if (firstLine.startsWith(READING_LIST_NOTE_MARKER)) {
		// Old format with just the marker
		return { title: null, tasks: rest };
	}
	return { title: null, tasks: content };
}

export function findReadingTasksNote(item: Zotero.Item): Zotero.Item | null {
	const noteIDs = item.getNotes(true);
	for (const id of noteIDs) {
		const note = Zotero.Items.get(id);
		if (!note?.isNote()) {
			continue;
		}
		const content = note.getNote();
		if (content.startsWith(READING_LIST_NOTE_MARKER)) {
			return note;
		}
	}
	return null;
}

export function getOrCreateReadingTasksNote(item: Zotero.Item): Zotero.Item {
	const existing = findReadingTasksNote(item);
	if (existing) {
		return existing;
	}
	const note = new Zotero.Item("note");
	note.libraryID = item.libraryID;
	note.parentID = item.id;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	(note as any).hidden = true;
	const title = getItemTitle(item);
	note.setNote(encodeContent(title, "[]"));
	void note.saveTx();
	return note;
}

export function getTasksFromNote(item: Zotero.Item): string | null {
	const note = findReadingTasksNote(item);
	if (!note) {
		return null;
	}
	const { title, tasks } = decodeContent(note.getNote());
	if (!title) {
		const itemTitle = getItemTitle(item);
		if (itemTitle) {
			note.setNote(encodeContent(itemTitle, tasks));
			void note.saveTx();
		}
	}
	return tasks;
}

export function getTitleFromNote(item: Zotero.Item): string | null {
	const note = findReadingTasksNote(item);
	if (!note) {
		return null;
	}
	const { title, tasks } = decodeContent(note.getNote());
	if (!title) {
		const itemTitle = getItemTitle(item);
		if (itemTitle) {
			note.setNote(encodeContent(itemTitle, tasks));
			void note.saveTx();
			return itemTitle;
		}
	}
	return title;
}

export function saveTasksToNote(item: Zotero.Item, tasks: string): void {
	const note = getOrCreateReadingTasksNote(item);
	const title = getItemTitle(item) || getTitleFromNote(item) || "";
	note.setNote(encodeContent(title, tasks));
	void note.saveTx();
}
