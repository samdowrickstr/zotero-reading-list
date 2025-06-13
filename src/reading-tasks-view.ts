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

function createInput(
	dialog: DialogHelper,
	value?: string,
	listId?: string,
	long = false,
) {
	const input = dialog.createElement(dialog.window.document, "input", {
		namespace: "html",
		properties: { type: "text", value: value || "" },
	});
	input.setAttribute("size", long ? "20" : "10");
	if (listId) {
		input.setAttribute("list", listId);
		input.addEventListener("input", () => {
			const list = dialog.window.document.getElementById(
				listId,
			) as HTMLDataListElement | null;
			if (!list) {
				return;
			}
			const val = input.value.toLowerCase();
			const options = Array.from(list.options) as HTMLOptionElement[];
			const matches = options.filter((o) =>
				o.value.toLowerCase().startsWith(val),
			);
			if (matches.length === 1) {
				const match = matches[0].value;
				if (match.length > val.length) {
					input.value = match;
					input.setSelectionRange(val.length, match.length);
				}
			}
		});
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
	moduleCell.append(createInput(dialog, task.module, "module-tags", true));
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
	const rowIndex = rowsCounter++;
	const typeGroup = dialog.createElement(doc, "div", {
		namespace: "html",
	});
	typeGroup.style.display = "flex";
	typeGroup.style.justifyContent = "center";
	const typeNames = [
		getString("reading-task-type-required"),
		getString("reading-task-type-additional"),
	];
	typeNames.forEach((t) => {
		const label = dialog.createElement(doc, "label", {
			namespace: "html",
		});
		label.style.marginRight = "8px";
		const radio = dialog.createElement(doc, "input", {
			namespace: "html",
			attributes: { type: "radio", name: `type-${rowIndex}`, value: t },
		});
		if ((task.type || typeNames[0]) === t) {
			radio.checked = true;
		}
		label.append(radio, doc.createTextNode(t));
		typeGroup.append(label);
	});
	typeCell.append(typeGroup);

	const statusCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	const group = dialog.createElement(doc, "div", {
		namespace: "html",
	});
	group.classList.add("status-group");
	group.style.display = "flex";
	group.style.justifyContent = "center";
	// reuse rowIndex for status radios
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

	const removeCell = dialog.createElement(doc, "td", {
		namespace: "html",
	});
	removeCell.style.textAlign = "center";
	const bin = dialog.createElement(doc, "button", {
		namespace: "html",
		properties: { innerHTML: "🗑" },
	});
	bin.style.display = "block";
	bin.style.margin = "0 auto";
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
		removeCell,
	);
	for (const cell of [
		moduleCell,
		unitCell,
		chapterCell,
		pagesCell,
		paragraphCell,
		typeCell,
		statusCell,
		removeCell,
	]) {
		(cell as HTMLElement).style.padding = "4px";
		(cell as HTMLElement).style.textAlign = "center";
	}
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
		const typeInput = cells[5].querySelector<HTMLInputElement>(
			'input[type="radio"]:checked',
		);
		const statusInput = cells[6].querySelector<HTMLInputElement>(
			'input[type="radio"]:checked',
		);

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
			type: typeInput?.value || undefined,
			status: statusInput?.value || statusNames[0],
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
	const dialog = new DialogHelper(1, 1);
	dialog.addCell(0, 0, {
		tag: "vbox",
		children: [
			{
				tag: "h2",
				namespace: "html",
				properties: {
					innerHTML: getString("reading-tasks-title"),
					style: "text-align:center;margin:0;",
				},
			},
			{
				tag: "div",
				namespace: "html",
				properties: {
					innerHTML: item.getField("title"),
					style: "text-align:center;font-weight:bold;margin-bottom:8px;",
				},
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
				tag: "table",
				namespace: "html",
				attributes: {
					style: "width:100%;border-collapse:collapse;text-align:center;",
				},
				children: [
					{
						tag: "thead",
						children: [
							{
								tag: "tr",
								children: [
									{
										tag: "th",
										properties: {
											innerHTML: "Module",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Unit",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Chapter",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Pages",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Paragraph",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Type",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Status",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Remove",
											style: "padding:4px;text-align:center;",
										},
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
		width: 900,
		height: 600,
		resizable: true,
	});
}

export default { open };
