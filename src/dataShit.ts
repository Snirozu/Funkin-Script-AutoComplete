import * as vscode from 'vscode';

import * as pengine_data from "./pengine_data.json";
import * as psych_data from "./psych_data.json";

export function getFunctions(): any {
	switch (vscode.workspace.getConfiguration().get("funkinscriptautocomplete.luaEngine")) {
		case "psych":
			return psych_data.functions;
		case "pengine":
			return pengine_data.functions;
	}
}

export function getFunction(func: string) {
	if (!Reflect.has(getFunctions(), func))
		return null;

	const funct = Reflect.get(getFunctions(), func);
	return {
		name: func,
		returns: funct.returns,
		args: funct.args,
		documentation: funct.documentation
	};
}

export function getEvents(): any {
	switch (vscode.workspace.getConfiguration().get("funkinscriptautocomplete.luaEngine")) {
		case "psych":
			return psych_data.events;
		case "pengine":
			return pengine_data.events;
	}
}

export function getEvent(event: string) {
	if (!Reflect.has(getEvents(), event))
		return null;

	const e = Reflect.get(getEvents(), event);
	return {
		name: event,
		returns: e.returns,
		args: e.args,
		documentation: e.documentation
	};
}

export function getVariables(): any {
	switch (vscode.workspace.getConfiguration().get("funkinscriptautocomplete.luaEngine")) {
		case "psych":
			return psych_data.variables;
		case "pengine":
			return pengine_data.variables;
	}
}

export function getVariable(varia: string) {
	if (!Reflect.has(getVariables(), varia))
		return null;

	const funct = Reflect.get(getVariables(), varia);
	return {
		name: varia,
		returns: funct.returns,
		documentation: funct.documentation
	};
}