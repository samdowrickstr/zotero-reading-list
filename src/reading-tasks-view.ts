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
let rowsCounter = 0;

function createInput(dialog: DialogHelper, value?: string, listId?: string) {
	const input = dialog.createElement(dialog.window.document, "input", {
		namespace: "html",
		properties: { type: "text", value: value || "" },
	});
	if (listId) {
		input.setAttribute("list", listId);
	}
	return input;
}

function createTableRow(dialog: DialogHelper, task: Partial<ReadingTask> = {}) {
	const doc = dialog.window.document;
	const row = dialog.createElement(doc, "tr", {
		namespace: "html",
	});
	const [statusNames, statusIcons] = prefStringToList(
		getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
	);

	const moduleCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	moduleCell.append(createInput(dialog, task.module, "module-tags"));
	const unitCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	unitCell.append(createInput(dialog, task.unit, "unit-tags"));
	const chapterCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	chapterCell.append(createInput(dialog, task.chapter));
	const pagesCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	pagesCell.append(createInput(dialog, task.pages));
	const paragraphCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	paragraphCell.append(createInput(dialog, task.paragraph));

	const typeCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	typeCell.append(createInput(dialog, task.type, "type-tags"));

	const statusCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	const group = dialog.createElement(doc, "div", {
		namespace: "html",
	});
	group.classList.add("status-group");
	const rowIndex = rowsCounter++;
	statusNames.forEach((name, index) => {
		const label = dialog.createElement(doc, "label", {
			namespace: "html",
		});
		label.style.marginRight = "8px";
		const radio = dialog.createElement(doc, "input", {
			namespace: "html",
			attributes: {
				type: "radio",
				name: `status-${rowIndex}`,
				value: name,
			},
		});
		if ((task.status || statusNames[0]) === name) {
			radio.checked = true;
		}
		const text = dialog.createElement(doc, "span", {
			namespace: "html",
			properties: { innerHTML: `${statusIcons[index]} ${name}` },
		});
		label.append(radio, text);
		group.append(label);
	});
	statusCell.append(group);

	const doneCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	const check = dialog.createElement(doc, "input", {
		namespace: "html",
		properties: { type: "checkbox", checked: !!task.done },
	});
	doneCell.append(check);

	const removeCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	const bin = dialog.createElement(doc, "button", {
		namespace: "html",
		properties: { innerHTML: "🗑" },
	});
	bin.addEventListener("click", () => row.remove());
	removeCell.append(bin);

	row.append(
		moduleCell,
		unitCell,
		chapterCell,
		pagesCell,
		paragraphCell,
		typeCell,
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
			type:
				(cells[5].firstChild as HTMLInputElement).value.trim() ||
				undefined,
			status:
				(
					cells[6].querySelector(
						'input[type="radio"]:checked',
					) as HTMLInputElement
				)?.value || statusNames[0],
			done: (cells[7].firstChild as HTMLInputElement).checked,
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

async function open(item: Zotero.Item) {
	rowsCounter = 0;
	const allTags = (await Zotero.Tags.getAll(item.libraryID)).map(
		(t) => t.tag,
	);
	const unitTags = allTags.filter((n: string) => /^Unit\s/i.test(n));
	const moduleTags = allTags.filter((n: string) => /ULAW/.test(n));
	const typeSet = new Set<string>(
		allTags.filter((n: string) =>
			/Required Reading|Additional Reading/i.test(n),
		),
	);
	typeSet.add(getString("reading-task-type-required"));
	typeSet.add(getString("reading-task-type-additional"));
	const typeTags = Array.from(typeSet);
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
				tag: "datalist",
				namespace: "html",
				attributes: { id: "module-tags" },
				children: moduleTags.map((m: string) => ({
					tag: "option" as const,
					attributes: { value: m },
				})),
			},
			{
				tag: "datalist",
				namespace: "html",
				attributes: { id: "unit-tags" },
				children: unitTags.map((u: string) => ({
					tag: "option" as const,
					attributes: { value: u },
				})),
			},
			{
				tag: "datalist",
				namespace: "html",
				attributes: { id: "type-tags" },
				children: typeTags.map((t: string) => ({
					tag: "option" as const,
					attributes: { value: t },
				})),
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
										properties: { innerHTML: "Type" },
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
