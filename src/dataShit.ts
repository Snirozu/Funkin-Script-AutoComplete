import * as vscode from 'vscode';

import * as pengine_data from "./pengine_data.json";
import * as psych_data from "./psych_data.json";

import { getLineContentAt } from './util';

export function getFunctions(document?:vscode.TextDocument): any {
	switch (getLuaEngine(document)) {
		case "psych":
			return psych_data.functions;
		case "pengine":
			return pengine_data.functions;
	}
}

export function getFunction(func: string, document?: vscode.TextDocument) {
	if (!Reflect.has(getFunctions(document), func))
		return null;

	const funct = Reflect.get(getFunctions(document), func);
	return {
		name: func,
		returns: funct.returns,
		args: funct.args,
		documentation: funct.documentation,
		deprecated: funct.deprecated
	};
}

export function getEvents(document?: vscode.TextDocument): any {
	switch (getLuaEngine(document)) {
		case "psych":
			return psych_data.events;
		case "pengine":
			return pengine_data.events;
	}
}

export function getEvent(event: string, document?: vscode.TextDocument) {
	if (!Reflect.has(getEvents(document), event))
		return null;

	const e = Reflect.get(getEvents(document), event);
	return {
		name: event,
		returns: e.returns,
		args: e.args,
		documentation: e.documentation
	};
}

export function getVariables(document?: vscode.TextDocument): any {
	switch (getLuaEngine(document)) {
		case "psych":
			return psych_data.variables;
		case "pengine":
			return pengine_data.variables;
	}
}

export function getVariable(varia: string, document?: vscode.TextDocument) {
	if (!Reflect.has(getVariables(document), varia))
		return null;

	const funct = Reflect.get(getVariables(document), varia);
	return {
		name: varia,
		returns: funct.returns,
		documentation: funct.documentation
	};
}

function getLuaEngine(document?:vscode.TextDocument | undefined) {
	if (document != undefined) {
		const str = "---@funkinEngine=";
		const line = getLineContentAt(document.getText(), document.getText().indexOf(str));
		if (line != null) {
			return line.trim().split("=")[1];
		}
	}
	return vscode.workspace.getConfiguration().get("funkinscriptautocomplete.luaEngine");
}