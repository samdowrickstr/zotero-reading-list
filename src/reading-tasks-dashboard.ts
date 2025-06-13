import { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "./utils/locale";
import { getReadingTasks, ReadingTask } from "./modules/reading-tasks";
import { getTitleFromNote } from "./utils/noteHelpers";

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
		// Ensure each item is fully loaded so child notes are available
		for (const item of items) {
			if (typeof item.loadAllData === "function") {
				await item.loadAllData();
			}
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
		it.item.getField("title") || getTitleFromNote(it.item) || "",
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
		td.style.padding = "4px";
		td.style.textAlign = "center";
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
				tag: "h2",
				namespace: "html",
				properties: {
					innerHTML: getString("reading-tasks-dashboard-title"),
					style: "text-align:center;margin:0 0 8px 0;",
				},
			},
			{
				tag: "input",
				namespace: "html",
				attributes: {
					id: FILTER_ID,
					placeholder: getString("filter-placeholder"),
					type: "search",
					style: "display:block;margin:0 auto 8px auto;width:95%;",
				},
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
											innerHTML: "Title",
											style: "padding:4px;text-align:center;",
										},
									},
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
		tasks = tasks.filter((it) => {
			const title =
				it.item.getField("title") || getTitleFromNote(it.item) || "";
			return `${title} ${it.task.module} ${it.task.unit} ${
				it.task.chapter || ""
			} ${it.task.pages || ""} ${it.task.paragraph || ""} ${
				it.task.type || ""
			} ${it.task.status}`
				.toLowerCase()
				.includes(filter);
		});
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
		return it.item.getField("title") || getTitleFromNote(it.item) || "";
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
