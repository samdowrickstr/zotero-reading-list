export const READING_LIST_NOTE_TITLE = "ReadingListTasks";

export function findReadingTasksNote(item: Zotero.Item): Zotero.Item | null {
	const noteIDs = item.getNotes();
	for (const id of noteIDs) {
		const note = Zotero.Items.get(id);
		if (note && note.getField("title") === READING_LIST_NOTE_TITLE) {
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
	note.setField("title", READING_LIST_NOTE_TITLE);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	(note as any).hidden = true;
	note.setNote("[]");
	void note.saveTx();
	return note;
}

export function getTasksFromNote(item: Zotero.Item): string | null {
	const note = findReadingTasksNote(item);
	return note ? note.getNote() : null;
}

export function saveTasksToNote(item: Zotero.Item, tasks: string): void {
	const note = getOrCreateReadingTasksNote(item);
	note.setNote(tasks);
	void note.saveTx();
}
