import { DialogHelper } from "zotero-plugin-toolkit";
import { getString } from "./utils/locale";
import {
	ReadingTask,
	setReadingTasks,
	updateItemTagsFromTasks,
	sortTasks,
} from "./modules/reading-tasks";

const INPUT_ID = "import-reading-tasks-input";
const TABLE_BODY = "import-reading-tasks-table";
let currentItem: Zotero.Item | null = null;
let parsedTasks: ReadingTask[] = [];

function parseTasks(text: string): ReadingTask[] {
	const trimmed = text.trim();
	if (!trimmed) return [];
	const m = trimmed.match(/Reading_Tasks:\s*([\s\S]+)/);
	const jsonText = m ? m[1].trim() : trimmed;
	try {
		return JSON.parse(jsonText) as ReadingTask[];
	} catch {
		return [];
	}
}

function createRow(doc: Document, task: ReadingTask) {
	const tr = doc.createElement("tr");
	const vals = [
		task.module,
		task.unit,
		task.chapter || "",
		task.pages || "",
		task.paragraph || "",
		task.type || "",
		task.status,
	];
	for (const val of vals) {
		const td = doc.createElement("td");
		td.textContent = val;
		td.style.padding = "4px";
		td.style.textAlign = "center";
		tr.appendChild(td);
	}
	return tr;
}

function parse(win: Window) {
	const textarea = win.document.getElementById(
		INPUT_ID,
	) as HTMLTextAreaElement | null;
	if (!textarea) return;
	parsedTasks = sortTasks(parseTasks(textarea.value));
	const tbody = win.document.getElementById(
		TABLE_BODY,
	) as HTMLTableSectionElement | null;
	if (!tbody) return;
	tbody.replaceChildren();
	for (const t of parsedTasks) {
		tbody.appendChild(createRow(win.document, t));
	}
}

function doImport(win: Window) {
	if (!currentItem) return;
	setReadingTasks(currentItem, parsedTasks);
	updateItemTagsFromTasks(currentItem);
	win.close();
}

function onLoad(win: Window) {
	// nothing to load
}

export function open(item: Zotero.Item) {
	currentItem = item;
	parsedTasks = [];
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
				tag: "div",
				namespace: "html",
				properties: {
					innerHTML: item.getField("title") || "",
					style: "text-align:center;font-weight:bold;margin-bottom:8px;",
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
		loadCallback: () => onLoad(dialog.window),
		l10nFiles: "__addonRef__-addon.ftl",
	});
	dialog.open(getString("import-reading-tasks-title"), {
		width: 600,
		height: 500,
		resizable: true,
	});
}

export default { open };
