import { MenuitemOptions } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { patch as $patch$, unpatch as $unpatch$ } from "../utils/patcher";
import {
	getPref,
	setPref,
	clearPref,
	initialiseDefaultPref,
	getPrefGlobalName,
} from "../utils/prefs";
import {
	getItemExtraProperty,
	setItemExtraProperty,
	clearItemExtraProperty,
	removeFieldValueFromExtraData,
} from "../utils/extraField";
import {
	addReadingTask,
	getReadingTasks,
	tasksToString,
	updateItemTagsFromTasks,
} from "./reading-tasks";

const READ_STATUS_COLUMN_ID = "readstatus";
export const READ_STATUS_EXTRA_FIELD = "Read_Status";
export const READ_DATE_EXTRA_FIELD = "Read_Status_Date";

export const DEFAULT_STATUS_NAMES = [
	"New",
	"To Read",
	"In Progress",
	"Read",
	"Not Reading",
];
export const DEFAULT_STATUS_ICONS = ["⭐", "📙", "📖", "📗", "📕"];

export const DEFAULT_STATUS_CHANGE_FROM = ["New", "To Read"];
export const DEFAULT_STATUS_CHANGE_TO = ["In Progress", "In Progress"];

export const SHOW_ICONS_PREF = "show-icons"; // deprecated
export const READ_STATUS_FORMAT_PREF = "read-status-format";
export const READ_STATUS_FORMAT_HEADER_SHOW_ICON =
	"readstatuscolumn-format-header-showicon";
export const LABEL_NEW_ITEMS_PREF = "label-new-items";
export const LABEL_NEW_ITEMS_PREF_DISABLED = "|none|";
export const LABEL_ITEMS_WHEN_OPENING_FILE_PREF =
	"label-items-when-opening-file";
export const ENABLE_KEYBOARD_SHORTCUTS_PREF = "enable-keyboard-shortcuts";
export const STATUS_NAME_AND_ICON_LIST_PREF = "statuses-and-icons-list";
export const STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF =
	"status-change-on-open-item-list";

enum ReadStatusFormat {
	ShowBoth = 0,
	ShowText = 1,
	ShowIcon = 2,
}

function getItemReadStatus(item: Zotero.Item) {
	const statusField = getItemExtraProperty(item, READ_STATUS_EXTRA_FIELD);
	return statusField.length == 1 ? statusField[0] : "";
}

export function setItemReadStatus(item: Zotero.Item, statusName: string) {
	setItemExtraProperty(item, READ_STATUS_EXTRA_FIELD, statusName);
	setItemExtraProperty(
		item,
		READ_DATE_EXTRA_FIELD,
		new Date(Date.now()).toISOString(),
	);
	void item.saveTx();
}

function setItemsReadStatus(items: Zotero.Item[], statusName: string) {
	for (const item of items) {
		setItemReadStatus(item, statusName);
	}
}

function setSelectedItemsReadStatus(statusName: string) {
	setItemsReadStatus(getSelectedItems(), statusName);
}

function clearSelectedItemsReadStatus() {
	const items = getSelectedItems();
	for (const item of items) {
		clearItemExtraProperty(item, READ_STATUS_EXTRA_FIELD);
		clearItemExtraProperty(item, READ_DATE_EXTRA_FIELD);
		void item.saveTx();
	}
}

export function updateItemStatusFromTasks(item: Zotero.Item) {
	const tasks = getReadingTasks(item);
	if (!tasks.length) {
		return;
	}
	const [statusNames] = prefStringToList(
		getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
	);
	let idx = 0;
	for (const t of tasks) {
		const sIdx = statusNames.indexOf(t.status);
		if (sIdx > idx) {
			idx = sIdx;
		}
	}
	setItemReadStatus(item, statusNames[idx]);
	updateItemTagsFromTasks(item);
}

/**
 * Return selected regular items
 */
function getSelectedItems() {
	return ZoteroPane.getSelectedItems().filter((item) => item.isRegularItem());
}

function showReadingTasks() {
	const items = getSelectedItems();
	if (!items.length) {
		return;
	}
	const lines: string[] = [];
	for (const item of items) {
		const tasks = getReadingTasks(item);
		if (tasks.length) {
			lines.push(item.getField("title"));
			lines.push(tasksToString(tasks));
		}
	}
	const message = lines.length
		? lines.join("\n")
		: getString("reading-tasks-none");

	Services.prompt.alert(
		window as mozIDOMWindowProxy,
		getString("reading-tasks-title"),
		message,
	);
}

function openManageReadingTasks() {
	const items = getSelectedItems();
	if (!items.length) {
		return;
	}
	void addon.readingTasksView.open(items[0]);
}

function openImportReadingTasks() {
	const items = getSelectedItems();
	if (!items.length) {
		return;
	}
	void addon.readingTasksImport.open(items[0]);
}

function promptAddReadingTask() {
	const items = getSelectedItems();
	if (!items.length) {
		return;
	}
	const promptSvc: { prompt(...args: any[]): boolean } =
		Services.prompt as unknown as { prompt(...args: any[]): boolean };
	const moduleInput = { value: "" };

	if (
		!promptSvc.prompt(
			window as mozIDOMWindowProxy,
			getString("add-reading-task-menu"),
			getString("reading-task-prompt-module"),
			moduleInput,
			null,
			{},
		)
	) {
		return;
	}
	const unitInput = { value: "" };

	if (
		!promptSvc.prompt(
			window as mozIDOMWindowProxy,
			getString("add-reading-task-menu"),
			getString("reading-task-prompt-unit"),
			unitInput,
			null,
			{},
		)
	) {
		return;
	}
	const chapterInput = { value: "" };

	promptSvc.prompt(
		window as mozIDOMWindowProxy,
		getString("add-reading-task-menu"),
		getString("reading-task-prompt-chapter"),
		chapterInput,
		null,
		{},
	);
	const pagesInput = { value: "" };

	promptSvc.prompt(
		window as mozIDOMWindowProxy,
		getString("add-reading-task-menu"),
		getString("reading-task-prompt-pages"),
		pagesInput,
		null,
		{},
	);
	const paragraphInput = { value: "" };

	promptSvc.prompt(
		window as mozIDOMWindowProxy,
		getString("add-reading-task-menu"),
		getString("reading-task-prompt-paragraph"),
		paragraphInput,
		null,
		{},
	);

	const typeInput = { value: getString("reading-task-type-required") };

	promptSvc.prompt(
		window as mozIDOMWindowProxy,
		getString("add-reading-task-menu"),
		getString("reading-task-prompt-type"),
		typeInput,
		null,
		{},
	);

	const task = {
		module: moduleInput.value.trim(),
		unit: unitInput.value.trim(),
		chapter: chapterInput.value.trim() || undefined,
		pages: pagesInput.value.trim() || undefined,
		paragraph: paragraphInput.value.trim() || undefined,
		type: typeInput.value.trim() || undefined,
		status:
			prefStringToList(
				getPref(STATUS_NAME_AND_ICON_LIST_PREF) as string,
			)[0][1] || "To Read",
	} as import("./reading-tasks").ReadingTask;

	for (const item of items) {
		addReadingTask(item, task);
		updateItemStatusFromTasks(item);
	}
}

export const FORBIDDEN_PREF_STRING_CHARACTERS = new Set(":;|");

export function prefStringToList(prefString: string) {
	const [statusString, iconString] = prefString.split("|");
	return [statusString.split(";"), iconString.split(";")];
}

export function listToPrefString(stringList: string[], iconList: string[]) {
	return stringList.join(";") + "|" + iconList.join(";");
}

export default class ZoteroReadingList {
	itemAddedListenerID?: string;
	fileOpenedListenerID?: string;
	itemTreeReadStatusColumnId?: string | false;
	preferenceUpdateObservers?: symbol[];
	readingTasksPaneID?: string | false;
	statusNames: string[];
	statusIcons: string[];

	constructor() {
		this.initialiseDefaultPreferences();
		[this.statusNames, this.statusIcons] = prefStringToList(
			getPref(STATUS_NAME_AND_ICON_LIST_PREF)! as string,
		);

		this.addReadStatusColumn();
		this.addPreferencesMenu();
		this.addRightClickMenuPopup();
		this.addReadingTasksPane();

		if (getPref(ENABLE_KEYBOARD_SHORTCUTS_PREF)) {
			this.addKeyboardShortcutListener();
		}
		if (getPref(LABEL_NEW_ITEMS_PREF) != LABEL_NEW_ITEMS_PREF_DISABLED) {
			this.addNewItemLabeller();
		}
		if (getPref(LABEL_ITEMS_WHEN_OPENING_FILE_PREF)) {
			this.addFileOpenedListener();
		}

		this.addPreferenceUpdateObservers();
		this.removeReadStatusFromExports();
	}

	public unload() {
		this.removeReadStatusColumn();
		this.removePreferenceMenu();
		this.removeRightClickMenu();
		this.removeKeyboardShortcutListener();
		this.removeNewItemLabeller();
		this.removeFileOpenedListener();
		this.removePreferenceUpdateObservers();
		this.removeReadingTasksPane();
		this.unpatchExportFunction();
	}

	initialiseDefaultPreferences() {
		// for migrating from old format pref (show icon or not) to new format pref (show both, text, or icon)
		// show icon -> show both
		// don't show icon -> show text
		// otherwise, default is show both
		const oldReadStatusColumnFormatPref_showIcons =
			getPref(SHOW_ICONS_PREF);
		if (
			typeof oldReadStatusColumnFormatPref_showIcons == "boolean" &&
			!oldReadStatusColumnFormatPref_showIcons
		) {
			initialiseDefaultPref(
				READ_STATUS_FORMAT_PREF,
				ReadStatusFormat.ShowText,
			);
		} else {
			initialiseDefaultPref(
				READ_STATUS_FORMAT_PREF,
				ReadStatusFormat.ShowBoth,
			);
		}
		initialiseDefaultPref(READ_STATUS_FORMAT_HEADER_SHOW_ICON, false);
		initialiseDefaultPref(ENABLE_KEYBOARD_SHORTCUTS_PREF, true);
		initialiseDefaultPref(LABEL_ITEMS_WHEN_OPENING_FILE_PREF, false);
		initialiseDefaultPref(
			STATUS_NAME_AND_ICON_LIST_PREF,
			listToPrefString(DEFAULT_STATUS_NAMES, DEFAULT_STATUS_ICONS),
		);
		initialiseDefaultPref(
			STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF,
			listToPrefString(
				DEFAULT_STATUS_CHANGE_FROM,
				DEFAULT_STATUS_CHANGE_TO,
			),
		);
		// for migrating from old label new items pref (true or false) to new format pref (disabled or choose read status to use)
		// true -> automatically label as first read status
		// false -> disabled
		const oldLabelNewItemsPref = getPref(LABEL_NEW_ITEMS_PREF);
		if (typeof oldLabelNewItemsPref == "boolean") {
			// need to clear then set Pref when changing type from bool to string
			clearPref(LABEL_NEW_ITEMS_PREF);
			if (oldLabelNewItemsPref) {
				setPref(
					LABEL_NEW_ITEMS_PREF,
					prefStringToList(
						getPref(STATUS_NAME_AND_ICON_LIST_PREF)! as string,
					)[0][0],
				);
			} else {
				setPref(LABEL_NEW_ITEMS_PREF, LABEL_NEW_ITEMS_PREF_DISABLED);
			}
		} else {
			initialiseDefaultPref(
				LABEL_NEW_ITEMS_PREF,
				LABEL_NEW_ITEMS_PREF_DISABLED,
			);
		}
	}

	addPreferenceUpdateObservers() {
		this.preferenceUpdateObservers = [
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(ENABLE_KEYBOARD_SHORTCUTS_PREF),
				(value: boolean) => {
					if (value) {
						this.addKeyboardShortcutListener();
					} else {
						this.removeKeyboardShortcutListener();
					}
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(LABEL_NEW_ITEMS_PREF),
				(value: string) => {
					if (value == LABEL_NEW_ITEMS_PREF_DISABLED) {
						this.removeNewItemLabeller();
					} else if (typeof this.itemAddedListenerID == "undefined") {
						this.addNewItemLabeller();
					}
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(LABEL_ITEMS_WHEN_OPENING_FILE_PREF),
				(value: boolean) => {
					if (value) {
						this.addFileOpenedListener();
					} else {
						this.removeFileOpenedListener();
					}
				},
				true,
			),
			// refresh read status column on format change
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(READ_STATUS_FORMAT_PREF),
				(value: boolean) => {
					this.removeReadStatusColumn();
					this.removeRightClickMenu();
					this.addReadStatusColumn();
					this.addRightClickMenuPopup();
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(READ_STATUS_FORMAT_HEADER_SHOW_ICON),
				(value: boolean) => {
					this.removeReadStatusColumn();
					this.addReadStatusColumn();
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(STATUS_NAME_AND_ICON_LIST_PREF),
				(value: string) => {
					[this.statusNames, this.statusIcons] =
						prefStringToList(value);
					this.removeRightClickMenu();
					this.addRightClickMenuPopup();
					this.removeKeyboardShortcutListener();
					this.addKeyboardShortcutListener();
					this.removeReadStatusColumn();
					this.addReadStatusColumn();
				},
				true,
			),
		];
	}

	removePreferenceUpdateObservers() {
		if (this.preferenceUpdateObservers) {
			for (const preferenceUpdateObserverSymbol of this
				.preferenceUpdateObservers) {
				Zotero.Prefs.unregisterObserver(preferenceUpdateObserverSymbol);
			}
			this.preferenceUpdateObservers = undefined;
		}
	}

	addReadStatusColumn() {
		const formatStatusName = (statusName: string) =>
			this.formatStatusName(statusName);
		this.itemTreeReadStatusColumnId = Zotero.ItemTreeManager.registerColumn(
			{
				dataKey: READ_STATUS_COLUMN_ID,
				label: getString("read-status"),
				// If we just want to show the icon, overwrite the label with htmlLabel (#40)
				htmlLabel: getPref(READ_STATUS_FORMAT_HEADER_SHOW_ICON)
					? `<span class="icon icon-css icon-16" style="background: url(chrome://${config.addonRef}/content/icons/favicon.png) content-box no-repeat center/contain;" />`
					: undefined,
				pluginID: config.addonID,
				dataProvider: (item: Zotero.Item, dataKey: string) => {
					return item.isRegularItem() ? getItemReadStatus(item) : "";
				},
				// if we put the icon in the dataprovider, it only gets updated when the read status changes
				// putting the icon in the render function updates when the row is clicked or column is sorted
				renderCell: function (
					index: number,
					data: string,
					column: { className: string },
				) {
					const text = document.createElementNS(
						"http://www.w3.org/1999/xhtml",
						"span",
					);
					text.className = "cell-text";
					text.innerText = formatStatusName(data);

					const cell = document.createElementNS(
						"http://www.w3.org/1999/xhtml",
						"span",
					);
					cell.className = `cell ${column.className}`;
					cell.append(text);

					return cell;
				},
				zoteroPersist: ["width", "hidden", "sortDirection"],
			},
		);
	}

	/**
	 * Format name of status to localise text and include icon if enabled.
	 * @param {string} statusName - The name of the status.
	 * @returns {String} values - Name of the status, possibly prefixed with the corresponding icon.
	 */
	formatStatusName(statusName: string): string {
		switch (getPref(READ_STATUS_FORMAT_PREF) as ReadStatusFormat) {
			case ReadStatusFormat.ShowBoth: {
				const statusIndex = this.statusNames.indexOf(statusName);
				return statusIndex > -1
					? `${this.statusIcons[statusIndex]} ${statusName}`
					: statusName;
			}
			case ReadStatusFormat.ShowText: {
				return statusName;
			}
			case ReadStatusFormat.ShowIcon: {
				const statusIndex = this.statusNames.indexOf(statusName);
				return statusIndex > -1
					? `${this.statusIcons[statusIndex]}`
					: statusName;
			}
		}
	}

	removeReadStatusColumn() {
		if (this.itemTreeReadStatusColumnId) {
			Zotero.ItemTreeManager.unregisterColumn(
				this.itemTreeReadStatusColumnId,
			);
			this.itemTreeReadStatusColumnId = undefined;
		}
	}

	addPreferencesMenu() {
		const prefOptions = {
			pluginID: config.addonID,
			src: rootURI + "chrome/content/preferences.xhtml",
			label: getString("prefs-title"),
			image: `chrome://${config.addonRef}/content/icons/favicon.png`,
			defaultXUL: true,
		};
		void Zotero.PreferencePanes.register(prefOptions);
	}

	removePreferenceMenu() {
		Zotero.PreferencePanes.unregister(config.addonID);
	}

	addRightClickMenuPopup() {
		ztoolkit.Menu.register("item", {
			id: "zotero-reading-list-right-click-item-menu",
			tag: "menu",
			label: getString("menupopup-label"),
			children: [
				{
					tag: "menuitem" as const,
					label: getString("status-none"),
					commandListener: () => void clearSelectedItemsReadStatus(),
				} as MenuitemOptions,
				...this.statusNames.map(
					(status_name: string): MenuitemOptions => ({
						tag: "menuitem" as const,
						label: this.formatStatusName(status_name),
						commandListener: () =>
							setSelectedItemsReadStatus(status_name),
					}),
				),
				{
					tag: "menuitem" as const,
					label: getString("reading-tasks-menu"),
					commandListener: () => showReadingTasks(),
				} as MenuitemOptions,
				{
					tag: "menuitem" as const,
					label: getString("add-reading-task-menu"),
					commandListener: () => promptAddReadingTask(),
				} as MenuitemOptions,
				{
					tag: "menuitem" as const,
					label: getString("manage-reading-tasks-menu"),
					commandListener: () => openManageReadingTasks(),
				} as MenuitemOptions,
				{
					tag: "menuitem" as const,
					label: getString("reading-tasks-dashboard-title"),
					commandListener: () =>
						void addon.readingTasksDashboard.open(),
				} as MenuitemOptions,
				{
					tag: "menuitem" as const,
					label: getString("import-reading-tasks-menu"),
					commandListener: () => openImportReadingTasks(),
				} as MenuitemOptions,
			] as MenuitemOptions[],
			getVisibility: (element, event) => {
				return getSelectedItems().length > 0;
			},
		});
	}

	removeRightClickMenu() {
		ztoolkit.Menu.unregister("zotero-reading-list-right-click-item-menu");
	}

	addReadingTasksPane() {
		this.readingTasksPaneID = Zotero.ItemPaneManager.registerSection({
			paneID: "zotero-reading-tasks-pane",
			pluginID: config.addonID,
			header: {
				l10nID: "reading-tasks-title",
				icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
			},
			sidenav: {
				l10nID: "reading-tasks-title",
				icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
			},
			bodyXHTML:
				'<div xmlns="http://www.w3.org/1999/xhtml"><div id="reading-tasks-pane-body" style="white-space: pre-wrap;"></div><div style="margin-top:4px;"><button id="reading-tasks-pane-add"></button><button id="reading-tasks-pane-manage" style="margin-left:4px;"></button><button id="reading-tasks-pane-dashboard" style="margin-left:4px;"></button><button id="reading-tasks-pane-import" style="margin-left:4px;"></button></div></div>',
			onRender: ({
				body,
				item,
			}: {
				body: HTMLElement;
				item: Zotero.Item;
			}) => {
				const tasks = getReadingTasks(item);
				const textDiv = body.querySelector("#reading-tasks-pane-body");
				if (textDiv) {
					textDiv.textContent = tasks.length
						? tasksToString(tasks)
						: getString("reading-tasks-none");
				}
				const addBtn = body.querySelector<HTMLButtonElement>(
					"#reading-tasks-pane-add",
				);
				if (addBtn) {
					addBtn.textContent = getString("add-reading-task-menu");
					addBtn.onclick = () => promptAddReadingTask(); // ← one handler only
				}

				const manageBtn = body.querySelector<HTMLButtonElement>(
					"#reading-tasks-pane-manage",
				);
				if (manageBtn) {
					manageBtn.textContent = getString(
						"manage-reading-tasks-menu",
					);
					manageBtn.onclick = () => addon.readingTasksView.open(item); // ← one handler only
				}

				const dashBtn = body.querySelector<HTMLButtonElement>(
					"#reading-tasks-pane-dashboard",
				);
				if (dashBtn) {
					dashBtn.textContent = getString(
						"reading-tasks-dashboard-title",
					);
					dashBtn.onclick = () =>
						void addon.readingTasksDashboard.open();
				}

				const importBtn = body.querySelector<HTMLButtonElement>(
					"#reading-tasks-pane-import",
				);
				if (importBtn) {
					importBtn.textContent = getString(
						"import-reading-tasks-menu",
					);
					importBtn.onclick = () =>
						void addon.readingTasksImport.open(item);
				}
			},
		});
	}

	removeReadingTasksPane() {
		if (typeof this.readingTasksPaneID === "string") {
			Zotero.ItemPaneManager.unregisterSection(this.readingTasksPaneID);
			this.readingTasksPaneID = undefined;
		}
	}

	addNewItemLabeller() {
		const addItemHandler = (
			action: _ZoteroTypes.Notifier.Event,
			type: _ZoteroTypes.Notifier.Type,
			ids: string[] | number[],
			extraData: _ZoteroTypes.anyObj,
		) => {
			if (action == "add") {
				const items = Zotero.Items.get(ids).filter((item) =>
					item.isRegularItem(),
				);

				setItemsReadStatus(
					items,
					getPref(LABEL_NEW_ITEMS_PREF)! as string,
				);
			}
		};

		this.itemAddedListenerID = Zotero.Notifier.registerObserver(
			{
				notify(...args) {
					// eslint-disable-next-line prefer-spread
					addItemHandler.apply(null, args);
				},
			},
			["item"],
			"zotero-reading-list",
			1,
		);
	}

	removeNewItemLabeller() {
		if (this.itemAddedListenerID) {
			Zotero.Notifier.unregisterObserver(this.itemAddedListenerID);
			this.itemAddedListenerID = undefined;
		}
	}

	addFileOpenedListener() {
		const fileOpenHandler = (
			action: string,
			type: string,
			ids: string[] | number[],
			extraData: any,
		) => {
			if (action == "open") {
				const items = Zotero.Items.getTopLevel(
					Zotero.Items.get(ids as number[]),
				);

				const [statusFrom, statusTo] = prefStringToList(
					getPref(STATUS_CHANGE_ON_OPEN_ITEM_LIST_PREF) as string,
				);

				for (const item of items) {
					const itemReadStatusIndex = statusFrom.indexOf(
						getItemReadStatus(item),
					);
					if (itemReadStatusIndex > -1) {
						setItemReadStatus(item, statusTo[itemReadStatusIndex]);
					}
				}
			}
		};

		this.fileOpenedListenerID = Zotero.Notifier.registerObserver(
			{
				notify(...args) {
					// eslint-disable-next-line prefer-spread
					fileOpenHandler.apply(null, args);
				},
			},
			["file"],
			"zotero-reading-list",
			1,
		);
	}

	removeFileOpenedListener() {
		if (this.fileOpenedListenerID) {
			Zotero.Notifier.unregisterObserver(this.fileOpenedListenerID);
			this.fileOpenedListenerID = undefined;
		}
	}

	keyboardEventHandler = (keyboardEvent: KeyboardEvent) => {
		// Check modifiers - want Alt+{1,2,3,4,5} to label the currently selected items
		// Or Alt+0 to clear the current read status
		// Need to use keyboard event `code` instead of `key` to support different keyboard
		// layouts, as well as fix problems with Mac #9 #53
		const possibleKeyCombinations: Map<string, number> = new Map();
		for (let num = 0; num < this.statusNames.length; num++) {
			possibleKeyCombinations.set(`Digit${num + 1}`, num);
			possibleKeyCombinations.set(`Numpad${num + 1}`, num);
		}
		const clearStatusKeyCombinations = ["Digit0", "Numpad0"];
		if (
			!keyboardEvent.ctrlKey &&
			!keyboardEvent.shiftKey &&
			keyboardEvent.altKey
		) {
			if (possibleKeyCombinations.has(keyboardEvent.code)) {
				const selectedStatus =
					this.statusNames[
						possibleKeyCombinations.get(keyboardEvent.code)!
					];
				void setSelectedItemsReadStatus(selectedStatus);
			} else if (
				clearStatusKeyCombinations.includes(keyboardEvent.code)
			) {
				void clearSelectedItemsReadStatus();
			}
		}
	};

	addKeyboardShortcutListener() {
		// disable Zotero's column sorting (also uses Alt+Num shortcut keys) #30
		document
			.getElementById("sortSubmenuKeys")
			?.setAttribute("disabled", "true");
		// different approach compared to Zutilo https://github.com/wshanks/Zutilo/issues/71#issuecomment-360986808
		document.addEventListener("keydown", this.keyboardEventHandler);
	}

	removeKeyboardShortcutListener() {
		document.removeEventListener("keydown", this.keyboardEventHandler);
		// reenable Zotero's column sorting
		document
			.getElementById("sortSubmenuKeys")
			?.setAttribute("disabled", "false");
	}

	removeReadStatusFromExports() {
		// need to specify that `this` is an Object (ie. it's Zotero.Utilities.Internal) for TS to be happy
		$patch$(
			Zotero.Utilities.Internal,
			"itemToExportFormat",
			// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
			(original: Function) =>
				function Zotero_Utilities_Internal_itemToExportFormat(
					this: object,
					zoteroItem: Zotero.Item,
					_legacy: any,
					_skipChildItems: any,
				) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, prefer-rest-params
					const serializedItem = original.apply(this, arguments);
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					if (serializedItem.extra) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						let extraText = serializedItem.extra as string;
						extraText = removeFieldValueFromExtraData(
							extraText,
							READ_STATUS_EXTRA_FIELD,
						);
						extraText = removeFieldValueFromExtraData(
							extraText,
							READ_DATE_EXTRA_FIELD,
						);
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						serializedItem.extra = extraText;
					}
					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return serializedItem;
				},
		);
	}

	unpatchExportFunction() {
		$unpatch$(Zotero.Utilities.Internal, "itemToExportFormat");
	}
}
