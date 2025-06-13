import { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "./utils/locale";
import { getReadingTasks, ReadingTask } from "./modules/reading-tasks";

interface ItemTask {
	item: Zotero.Item;
	task: ReadingTask;
}

const BODY_ID = "reading-tasks-dashboard-body";
const FILTER_ID = "reading-tasks-dashboard-filter";

async function getAllItemTasks(): Promise<ItemTask[]> {
	const tasks: ItemTask[] = [];
	const libs = Zotero.Libraries.getAll();
	for (const lib of libs) {
		const items = await Zotero.Items.getAll(lib.libraryID, true);
		for (const item of items) {
			if (!item.isRegularItem()) {
				continue;
			}
			for (const task of getReadingTasks(item)) {
				tasks.push({ item, task });
			}
		}
	}
	return tasks;
}

function createRow(doc: Document, it: ItemTask) {
	const row = doc.createElement("tr");
	const cells = [
		it.item.getField("title"),
		it.task.module,
		it.task.unit,
		it.task.chapter || "",
		it.task.pages || "",
		it.task.paragraph || "",
		it.task.type || "",
		it.task.status,
	];
	for (const val of cells) {
		const td = doc.createElement("td");
		td.textContent = val;
		row.appendChild(td);
	}
	return row;
}

export function open() {
	const dialog = new DialogHelper(1, 1);
	dialog.addCell(0, 0, {
		tag: "vbox",
		children: [
			{
				tag: "input",
				namespace: "html",
				attributes: {
					id: FILTER_ID,
					placeholder: getString("filter-placeholder"),
					type: "search",
				},
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
										properties: { innerHTML: "Title" },
									},
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
								],
							},
						],
					},
					{ tag: "tbody", attributes: { id: BODY_ID } },
				],
			},
		],
	});
	dialog.addButton("Close", "close");
	dialog.setDialogData({
		loadCallback: () => {
			void onLoad(dialog.window);
		},
		l10nFiles: "__addonRef__-addon.ftl",
	});
	dialog.open(getString("reading-tasks-dashboard-title"), {
		width: 800,
		height: 600,
		resizable: true,
	});
}

let currentTasks: ItemTask[] = [];
let sortKey: keyof ItemTask["task"] | "title" = "title";
let sortAsc = true;

function applyFilterAndSort(doc: Document) {
	const filter =
		(
			doc.getElementById(FILTER_ID) as HTMLInputElement | null
		)?.value.toLowerCase() || "";
	const tbody = doc.getElementById(BODY_ID) as HTMLTableSectionElement | null;
	if (!tbody) {
		return;
	}
	tbody.replaceChildren();
	let tasks = currentTasks;
	if (filter) {
		tasks = tasks.filter((it) =>
			`${it.item.getField("title")} ${it.task.module} ${it.task.unit} ${
				it.task.chapter || ""
			} ${it.task.pages || ""} ${it.task.paragraph || ""} ${
				it.task.type || ""
			} ${it.task.status}`
				.toLowerCase()
				.includes(filter),
		);
	}
	tasks = tasks.slice().sort((a, b) => {
		const va = getValue(a, sortKey);
		const vb = getValue(b, sortKey);
		if (va < vb) return sortAsc ? -1 : 1;
		if (va > vb) return sortAsc ? 1 : -1;
		return 0;
	});
	for (const it of tasks) {
		tbody.appendChild(createRow(doc, it));
	}
}

function getValue(it: ItemTask, key: keyof ItemTask["task"] | "title") {
	if (key === "title") {
		return it.item.getField("title");
	}
	return it.task[key] || "";
}

async function onLoad(win: Window) {
	currentTasks = await getAllItemTasks();
	const doc = win.document;
	applyFilterAndSort(doc);
	const filterInput = doc.getElementById(
		FILTER_ID,
	) as HTMLInputElement | null;
	filterInput?.addEventListener("input", () => applyFilterAndSort(doc));
	const headers = Array.from(doc.querySelectorAll("thead th"));
	headers.forEach((th, index) => {
		if (!th) {
			return;
		}
		th.addEventListener("click", () => {
			const keys = [
				"title",
				"module",
				"unit",
				"chapter",
				"pages",
				"paragraph",
				"type",
				"status",
			] as (keyof ItemTask["task"] | "title")[];
			const key = keys[index];
			if (sortKey === key) {
				sortAsc = !sortAsc;
			} else {
				sortKey = key;
				sortAsc = true;
			}
			applyFilterAndSort(doc);
		});
	});
}

export default { open };
