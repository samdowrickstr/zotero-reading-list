import {
	getReadingTasks,
	setReadingTasks,
	ReadingTask,
} from "./modules/reading-tasks";
import { getPref } from "./utils/prefs";
import {
	STATUS_NAME_AND_ICON_LIST_PREF,
	prefStringToList,
	READ_STATUS_EXTRA_FIELD,
	READ_DATE_EXTRA_FIELD,
} from "./modules/overlay";
import { setItemExtraProperty } from "./utils/extraField";
import { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "./utils/locale";

const TABLE_BODY = "reading-tasks-table-body";

function createInput(dialog: DialogHelper, value?: string) {
	const input = dialog.createElement(dialog.window.document, "input", {
		namespace: "html",
		properties: { type: "text", value: value || "" },
	}) as HTMLInputElement;
	return input;
}

function createTableRow(dialog: DialogHelper, task: Partial<ReadingTask> = {}) {
	const doc = dialog.window.document;
	const row = dialog.createElement(doc, "tr", {
		namespace: "html",
	}) as HTMLTableRowElement;
	const [statusNames, statusIcons] = prefStringToList(
		getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
	);

	const moduleCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	moduleCell.append(createInput(dialog, task.module));
	const unitCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	unitCell.append(createInput(dialog, task.unit));
	const chapterCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	chapterCell.append(createInput(dialog, task.chapter));
	const pagesCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	pagesCell.append(createInput(dialog, task.pages));
	const paragraphCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	paragraphCell.append(createInput(dialog, task.paragraph));

	const statusCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	const menulist = dialog.createElement(doc, "menulist", {
		namespace: "xul",
	}) as XULMenuListElement;
	const menupopup = dialog.createElement(doc, "menupopup", {
		namespace: "xul",
	}) as XULPopupElement;
	statusNames.forEach((name, index) => {
		const menuitem = dialog.createElement(doc, "menuitem", {
			namespace: "xul",
			attributes: { value: name, label: `${statusIcons[index]} ${name}` },
		}) as XULElement;
		menupopup.append(menuitem);
	});
	menulist.append(menupopup);
	menulist.setAttribute("value", task.status || statusNames[0]);
	statusCell.append(menulist);

	const doneCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	const check = dialog.createElement(doc, "input", {
		namespace: "html",
		properties: { type: "checkbox", checked: !!task.done },
	}) as HTMLInputElement;
	doneCell.append(check);

	const removeCell = dialog.createElement(doc, "td", {
		namespace: "html",
	}) as HTMLTableCellElement;
	const bin = dialog.createElement(doc, "button", {
		namespace: "html",
		properties: { innerHTML: "🗑" },
	}) as HTMLButtonElement;
	bin.addEventListener("click", () => row.remove());
	removeCell.append(bin);

	row.append(
		moduleCell,
		unitCell,
		chapterCell,
		pagesCell,
		paragraphCell,
		statusCell,
		doneCell,
		removeCell,
	);
	return row;
}

function addTableRow(dialog: DialogHelper) {
	dialog.window.document
		.getElementById(TABLE_BODY)
		?.append(createTableRow(dialog));
}

function updateItemReadStatus(
	item: Zotero.Item,
	tasks: ReadingTask[],
	statuses: string[],
) {
	let idx = 0;
	for (const t of tasks) {
		const sIdx = statuses.indexOf(t.status);
		if (sIdx > idx) {
			idx = sIdx;
		}
	}
	setItemExtraProperty(item, READ_STATUS_EXTRA_FIELD, statuses[idx]);
	setItemExtraProperty(item, READ_DATE_EXTRA_FIELD, new Date().toISOString());
	void item.saveTx();
}

function save(window: Window) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const args = (window as any).arguments[0];
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const item = args.item as Zotero.Item;
	const [statusNames] = prefStringToList(
		getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
	);
	const rows = Array.from(
		window.document.getElementById(TABLE_BODY)?.children || [],
	) as HTMLTableRowElement[];
	const tasks: ReadingTask[] = [];
	for (const row of rows) {
		const cells = row.children;
		tasks.push({
			module: (cells[0].firstChild as HTMLInputElement).value.trim(),
			unit: (cells[1].firstChild as HTMLInputElement).value.trim(),
			chapter:
				(cells[2].firstChild as HTMLInputElement).value.trim() ||
				undefined,
			pages:
				(cells[3].firstChild as HTMLInputElement).value.trim() ||
				undefined,
			paragraph:
				(cells[4].firstChild as HTMLInputElement).value.trim() ||
				undefined,

			status:
				(cells[5].firstChild as XULMenuListElement).value ||
				statusNames[0],
			done: (cells[6].firstChild as HTMLInputElement).checked,
		});
	}
	setReadingTasks(item, tasks);
	updateItemReadStatus(item, tasks, statusNames);
	window.close();
}

function onLoad(window: Window) {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
	const args = (window as any).arguments[0];
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	const itemID = args.itemID as number;
	const item = Zotero.Items.get(itemID);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	args.item = item;
	const tasks = getReadingTasks(item);
	for (const task of tasks) {
		window.document
			.getElementById(TABLE_BODY)
			?.append(createTableRow(addon.data.dialog!, task));
	}
}

function open(item: Zotero.Item) {
	const dialog = new DialogHelper(1, 1);
	dialog.addCell(0, 0, {
		tag: "vbox",
		children: [
			{
				tag: "h2",
				namespace: "html",
				properties: { innerHTML: getString("reading-tasks-title") },
			},
			{
				tag: "table",
				namespace: "html",
				children: [
					{
						tag: "thead",
						children: [
							{
								tag: "tr",
								children: [
									{
										tag: "th",
										properties: { innerHTML: "Module" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Unit" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Chapter" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Pages" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Paragraph" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Status" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Done" },
									},
									{
										tag: "th",
										properties: { innerHTML: "Remove" },
									},
								],
							},
						],
					},
					{ tag: "tbody", attributes: { id: TABLE_BODY } },
				],
			},
		],
	});
	dialog.addButton(getString("add-reading-task-menu"), "add", {
		noClose: true,
		callback: () => addTableRow(dialog),
	});
	dialog.addButton("Save", "save", { callback: () => save(dialog.window) });
	dialog.setDialogData({
		itemID: item.id,
		loadCallback: () => onLoad(dialog.window),
		l10nFiles: "__addonRef__-addon.ftl",
	});
	addon.data.dialog = dialog;
	dialog.open(getString("manage-reading-tasks-menu"), {
		width: 1200,
		height: 400,
		resizable: true,
	});
}

export default { open };
