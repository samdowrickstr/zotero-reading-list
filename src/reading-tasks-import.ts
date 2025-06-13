import { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "./utils/locale";
import { ReadingTask, setReadingTasks } from "./modules/reading-tasks";
import { updateItemTagsFromTasks } from "./modules/reading-tasks";

interface ImportEntry {
	title: string;
	tasks: ReadingTask[];
}

interface ItemMap {
	[title: string]: Zotero.Item[];
}

const INPUT_ID = "import-reading-tasks-input";
const TABLE_BODY = "import-reading-tasks-table";
const TITLE_LIST = "import-reading-tasks-title-list";

let itemsByTitle: ItemMap = {};
let parsedEntries: ImportEntry[] = [];

function parseText(text: string): ImportEntry[] {
	const blocks = text
		.split(/\n\s*\n/)
		.map((b) => b.trim())
		.filter(Boolean);
	const entries: ImportEntry[] = [];
	for (const block of blocks) {
		const m = block.match(/^(.*)\nReading_Tasks:([\s\S]+)$/);
		if (!m) {
			continue;
		}
		const title = m[1].trim();
		const json = m[2].trim();
		try {
			const tasks = JSON.parse(json) as ReadingTask[];
			entries.push({ title, tasks });
		} catch {
			// ignore malformed JSON
		}
	}
	return entries;
}

async function gatherItems() {
	itemsByTitle = {};
	const libs = Zotero.Libraries.getAll();
	for (const lib of libs) {
		const items = await Zotero.Items.getAll(lib.libraryID, true);
		for (const item of items) {
			if (!item.isRegularItem()) continue;
			if (typeof item.loadAllData === "function") {
				await item.loadAllData();
			}
			const t = item.getField("title");
			if (!t) continue;
			const key = t.toLowerCase();
			if (!itemsByTitle[key]) itemsByTitle[key] = [];
			itemsByTitle[key].push(item);
		}
	}
}

function fillDatalist(doc: Document) {
	const list = doc.getElementById(TITLE_LIST) as HTMLDataListElement | null;
	if (!list) return;
	list.replaceChildren();
	for (const titleKey of Object.keys(itemsByTitle)) {
		const item = itemsByTitle[titleKey][0];
		const opt = doc.createElement("option");
		opt.value = item.getField("title") || "";
		list.appendChild(opt);
	}
}

function createRow(doc: Document, entry: ImportEntry, index: number) {
	const tr = doc.createElement("tr");
	tr.dataset.index = String(index);

	const titleTd = doc.createElement("td");
	titleTd.textContent = entry.title;
	titleTd.style.padding = "4px";
	titleTd.style.textAlign = "center";

	const matchTd = doc.createElement("td");
	const input = doc.createElement("input");
	input.setAttribute("list", TITLE_LIST);
	const match = (itemsByTitle[entry.title.toLowerCase()] || [])[0];
	if (match) {
		input.value = match.getField("title") || "";
	}
	matchTd.appendChild(input);
	matchTd.style.padding = "4px";
	matchTd.style.textAlign = "center";

	tr.appendChild(titleTd);
	tr.appendChild(matchTd);
	return tr;
}

function parse(window: Window) {
	const textarea = window.document.getElementById(
		INPUT_ID,
	) as HTMLTextAreaElement | null;
	if (!textarea) return;
	parsedEntries = parseText(textarea.value);
	const tbody = window.document.getElementById(
		TABLE_BODY,
	) as HTMLTableSectionElement | null;
	if (!tbody) return;
	tbody.replaceChildren();
	parsedEntries.forEach((e, idx) => {
		tbody.appendChild(createRow(window.document, e, idx));
	});
}

function doImport(window: Window) {
	const tbody = window.document.getElementById(
		TABLE_BODY,
	) as HTMLTableSectionElement | null;
	if (!tbody) return;
	const rows = Array.from(tbody.children) as HTMLTableRowElement[];
	for (const row of rows) {
		const idx = Number(row.dataset.index);
		const entry = parsedEntries[idx];
		const input = row.querySelector<HTMLInputElement>("input");
		if (!input) continue;
		const title = input.value.trim().toLowerCase();
		const item = itemsByTitle[title]?.[0];
		if (!item) continue;
		setReadingTasks(item, entry.tasks);
		updateItemTagsFromTasks(item);
	}
	window.close();
}

async function onLoad(win: Window) {
	await gatherItems();
	fillDatalist(win.document);
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
					innerHTML: getString("import-reading-tasks-title"),
					style: "text-align:center;margin:0 0 8px 0;",
				},
			},
			{
				tag: "textarea",
				namespace: "html",
				attributes: {
					id: INPUT_ID,
					style: "width:95%;height:120px;display:block;margin:0 auto 8px auto;",
				},
			},
			{
				tag: "datalist",
				namespace: "html",
				attributes: { id: TITLE_LIST },
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
											innerHTML: "Import Title",
											style: "padding:4px;text-align:center;",
										},
									},
									{
										tag: "th",
										properties: {
											innerHTML: "Matched Item",
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
	dialog.addButton(getString("import-reading-tasks-parse"), "parse", {
		noClose: true,
		callback: () => parse(dialog.window),
	});
	dialog.addButton(getString("import-reading-tasks-import"), "import", {
		callback: () => void doImport(dialog.window),
	});
	dialog.addButton("Close", "cancel");
	dialog.setDialogData({
		loadCallback: () => void onLoad(dialog.window),
		l10nFiles: "__addonRef__-addon.ftl",
	});
	dialog.open(getString("import-reading-tasks-title"), {
		width: 600,
		height: 500,
		resizable: true,
	});
}

export default { open };
