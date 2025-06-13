import { ColumnOptions, DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import prefsMenu from "./prefs-menu";
import readingTasksView from "./reading-tasks-view";
import readingTasksDashboard from "./reading-tasks-dashboard";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
	public data: {
		alive: boolean;
		// Env type, see build.js
		env: "development" | "production";
		ztoolkit: ZToolkit;
		locale?: {
			current: any;
		};
		prefs?: {
			window: Window;
			columns: Array<ColumnOptions>;
			rows: Array<{ [dataKey: string]: string }>;
		};
		dialog?: DialogHelper;
	};
	// Lifecycle hooks
	public hooks: typeof hooks;
	public prefsMenu: typeof prefsMenu;
	public readingTasksView: typeof readingTasksView;
	public readingTasksDashboard: typeof readingTasksDashboard;
	// APIs
	public api: object;

	constructor() {
		this.data = {
			alive: true,
			env: __env__,
			ztoolkit: createZToolkit(),
		};
		this.hooks = hooks;
		this.prefsMenu = prefsMenu;
		this.readingTasksView = readingTasksView;
		this.readingTasksDashboard = readingTasksDashboard;
		this.api = {};
	}
}

export default Addon;
