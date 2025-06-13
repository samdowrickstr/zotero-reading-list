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

function createElement(window: Window, tag: string) {
	return window.document.createElementNS("http://www.w3.org/1999/xhtml", tag);
}

function createInput(window: Window, value?: string) {
	const input = createElement(window, "html:input") as HTMLInputElement;
	input.type = "text";
	input.value = value || "";
	return input;
}

function createTableRow(window: Window, task: Partial<ReadingTask> = {}) {
	const row = createElement(window, "html:tr");
	const [statusNames, statusIcons] = prefStringToList(
		getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
	);

	const moduleCell = createElement(window, "html:td");
	moduleCell.append(createInput(window, task.module));
	const unitCell = createElement(window, "html:td");
	unitCell.append(createInput(window, task.unit));
	const chapterCell = createElement(window, "html:td");
	chapterCell.append(createInput(window, task.chapter));
	const pagesCell = createElement(window, "html:td");
	pagesCell.append(createInput(window, task.pages));
	const paragraphCell = createElement(window, "html:td");
	paragraphCell.append(createInput(window, task.paragraph));

	const statusCell = createElement(window, "html:td");
	const menuList = window.document.createXULElement(
		"menulist",
	) as unknown as XUL.MenuList;
	menuList.setAttribute("native", "true");
	const popup = window.document.createXULElement("menupopup");
	menuList.append(popup);
	statusNames.forEach((name, index) => {
		const label = `${statusIcons[index]} ${name}`;
		menuList.appendItem(label, name);
	});
	menuList.selectedIndex = statusNames.indexOf(task.status || statusNames[0]);
	statusCell.append(menuList as unknown as Node);

	const doneCell = createElement(window, "html:td");
	const check = createElement(window, "html:input") as HTMLInputElement;
	check.type = "checkbox";
	check.checked = !!task.done;
	doneCell.append(check);

	const removeCell = createElement(window, "html:td");
	const bin = createElement(window, "html:button");
	bin.textContent = "🗑";
	bin.onclick = () => row.remove();
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

function addTableRow(window: Window) {
	window.document.getElementById(TABLE_BODY)?.append(createTableRow(window));
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
				(
					cells[5].firstChild as unknown as XUL.MenuList
				).selectedItem?.getAttribute("value") || statusNames[0],
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
			?.append(createTableRow(window, task));
	}
}

function open(item: Zotero.Item) {
	const dialog = new DialogHelper(1, 1);
	dialog.addCell(0, 0, {
		tag: "vbox",
		children: [
			{
				tag: "html:h2",
				properties: { innerHTML: getString("reading-tasks-title") },
			},
			{
				tag: "html:table",
				children: [
					{
						tag: "html:thead",
						children: [
							{
								tag: "html:tr",
								children: [
									{
										tag: "html:th",
										properties: { innerHTML: "Module" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Unit" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Chapter" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Pages" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Paragraph" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Status" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Done" },
									},
									{
										tag: "html:th",
										properties: { innerHTML: "Remove" },
									},
								],
							},
						],
					},
					{ tag: "html:tbody", attributes: { id: TABLE_BODY } },
				],
			},
		],
	});
	dialog.addButton(getString("add-reading-task-menu"), "add", {
		noClose: true,
		callback: () => addTableRow(dialog.window),
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
