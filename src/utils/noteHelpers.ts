export const READING_LIST_NOTE_MARKER = "ReadingListTasks";

export function findReadingTasksNote(item: Zotero.Item): Zotero.Item | null {
	const noteIDs = item.getNotes();
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
	note.setNote(`${READING_LIST_NOTE_MARKER}\n[]`);
	void note.saveTx();
	return note;
}

export function getTasksFromNote(item: Zotero.Item): string | null {
	const note = findReadingTasksNote(item);
	if (!note) {
		return null;
	}
	const content = note.getNote();
	return content.replace(/^.+?\n/, "");
}

export function saveTasksToNote(item: Zotero.Item, tasks: string): void {
	const note = getOrCreateReadingTasksNote(item);
	note.setNote(`${READING_LIST_NOTE_MARKER}\n${tasks}`);
	void note.saveTx();
}
