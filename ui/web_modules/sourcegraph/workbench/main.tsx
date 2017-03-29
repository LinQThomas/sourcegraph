import "sourcegraph/feedback/feedback.contribution";

import "sourcegraph/editor/authorshipCodeLens";
import "sourcegraph/editor/authorshipWidget";
import "sourcegraph/editor/vscode";
import "sourcegraph/workbench/info/contrib";
import "sourcegraph/workbench/staticImports";

import "vs/editor/common/editorCommon";
import "vs/editor/contrib/codelens/browser/codelens";
import "vs/workbench/parts/files/browser/explorerViewlet";
import "vs/workbench/parts/files/browser/files.contribution";
import "vs/workbench/parts/git/electron-browser/git.contribution";
import "vs/workbench/parts/output/browser/output.contribution";
import "vs/workbench/parts/quickopen/browser/quickopen.contribution";
import "vs/workbench/parts/scm/electron-browser/scm.contribution";
import "vs/workbench/parts/search/browser/search.contribution";
import "vs/workbench/parts/search/browser/searchViewlet";

import { IDisposable } from "vs/base/common/lifecycle";
import URI from "vs/base/common/uri";
import { IInstantiationService } from "vs/platform/instantiation/common/instantiation";
import { ServiceCollection } from "vs/platform/instantiation/common/serviceCollection";
import { IWorkspaceRevState } from "vs/platform/workspace/common/workspace";
import "vs/workbench/electron-browser/main.contribution";
import { Workbench } from "vs/workbench/electron-browser/workbench";
import { ITextFileService } from "vs/workbench/services/textfile/common/textfiles";

import { init as initExtensionHost } from "sourcegraph/ext/main";
import { configurePostStartup, configurePreStartup } from "sourcegraph/workbench/config";
import { setupServices } from "sourcegraph/workbench/services";
import { GitTextFileService } from "sourcegraph/workbench/textFileService";
import { MiniStore } from "sourcegraph/workbench/utils";

export interface WorkbenchState {
	diffMode: boolean;
}

export const workbenchStore = new MiniStore<WorkbenchState>();

interface InitializedWorkbench {
	workbench: Workbench;
	services: ServiceCollection;
	domElement: HTMLDivElement;
}
let initializedWorkbench: InitializedWorkbench | null = null;

function fullHeightDiv(): HTMLDivElement {
	const div = document.createElement("div");
	div.style.height = "100%";
	div.style.flex = "1 1 100%";
	return div;
}
/**
 * init bootraps workbench creation.
 */
export function init(resource: URI, revState?: IWorkspaceRevState): InitializedWorkbench {
	if (initializedWorkbench) {
		workbenchListeners.forEach(cb => cb(true));
		return initializedWorkbench;
	}

	const parent = fullHeightDiv();
	parent.style.display = "flex";
	parent.style.flexDirection = "column";
	const domElement = fullHeightDiv();
	parent.appendChild(domElement);
	const workspace = resource.with({ fragment: "" });
	const services = setupServices(domElement, workspace, revState);
	configurePreStartup(services);
	window.localStorage.setItem("enablePreviewSCM", "true"); // TODO: move this.

	const instantiationService = services.get(IInstantiationService) as IInstantiationService;

	const workbench = instantiationService.createInstance(
		Workbench,
		parent,
		domElement,
		{},
		services,
	);
	workbench.startup();
	services.set(ITextFileService, instantiationService.createInstance(GitTextFileService));
	initExtensionHost(workspace, revState);

	configurePostStartup(services);
	workbenchListeners.forEach(cb => cb(true));

	if (!workbenchStore.isInitialized) {
		workbenchStore.init({ diffMode: Boolean(revState && revState.zapRef) });
	} else {
		workbenchStore.dispatch({ diffMode: Boolean(revState && revState.zapRef) });
	}

	initializedWorkbench = {
		domElement: parent,
		workbench,
		services,
	};
	return initializedWorkbench;
}

const workbenchListeners = new Set<(shown: boolean) => void>();

/**
 * onWorkbenchShown registers a listener callback that is invoked whenever
 * a new workbench is bootstrapped.
 */
export function onWorkbenchShown(listener: (shown: boolean) => void): IDisposable {
	workbenchListeners.add(listener);
	return {
		dispose: () => {
			workbenchListeners.delete(listener);
		}
	};
}

/**
 * unmount disposes registered listeners, and should be called when React unmounts
 * the WorkbenchShell component.
 */
export function unmount(): void {
	workbenchListeners.forEach(cb => cb(false));
}
