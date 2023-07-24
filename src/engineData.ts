import * as vscode from 'vscode';

//legacy data getting aka don't use it!
//import * as pengine_data from "./pengine_data.json";
//import * as psych_data from "./psych_data.json";

import { getLineContentAt } from './util';
import * as needle from 'needle';

// eslint-disable-next-line prefer-const
let engines:Map<string, any> = new Map<string, any>();

let latestVersion:string;

//FUCKK ASYNC FUCK YOUUUUUUUU ASYNC

export async function init(_engine:string):Promise<any> {
	let jason;
	let engine = _engine;
	if (!engine.includes("_")) {
		if (latestVersion != null)
			engine = latestVersion;
		else {
			const response = await needle("get", "https://raw.githubusercontent.com/Snirozu/Funkin-Script-AutoComplete/master/data/" + engine + "_latest.ver");
			engine = response.body;
		}
	}
	const response = await needle("get", "https://raw.githubusercontent.com/Snirozu/Funkin-Script-AutoComplete/master/data/" + engine + ".json");
	if (response.statusCode == 200) {
		jason = JSON.parse(response.body);
		engines.set(_engine, jason);
		return engines.get(_engine);
	}
	throw "Couldn't get engine data for engine: " + _engine;
}

export async function getEngineData(engiene:string | undefined):Promise<any> {
	if (engiene == undefined) throw "Extension couldn't find any engines...";

	if (engines.has(engiene) && engines.get(engiene) != null) {
		return engines.get(engiene);
	}
	return await init(engiene);
}

export async function getFunctions(document?:vscode.TextDocument): Promise<any> {
	return (await getEngineData(getLuaEngine(document))).functions;
}

export async function getEvents(document?: vscode.TextDocument): Promise<any> {
	return (await getEngineData(getLuaEngine(document))).events;
}

export async function getVariables(document?: vscode.TextDocument): Promise<any> {
	return (await getEngineData(getLuaEngine(document))).variables;
}

export async function getFunction(func: string, document?: vscode.TextDocument) {
	const functions = await getFunctions(document);
	if (!Reflect.has(functions, func))
		return null;

	const funct = Reflect.get(functions, func);
	return {
		name: func,
		returns: funct.returns,
		args: funct.args,
		documentation: funct.documentation,
		deprecated: funct.deprecated
	};
}

export async function getEvent(event: string, document?: vscode.TextDocument) {
	const events = await getEvents(document);
	if (!Reflect.has(events, event))
		return null;

	const e = Reflect.get(events, event);
	return {
		name: event,
		returns: e.returns,
		args: e.args,
		documentation: e.documentation,
		deprecated: e.deprecated
	};
}

export async function getVariable(varia: string, document?: vscode.TextDocument) {
	const variables = await getVariables(document);
	if (!Reflect.has(variables, varia))
		return null;

	const varr = Reflect.get(variables, varia);
	return {
		name: varia,
		returns: varr.returns,
		documentation: varr.documentation,
		deprecated: varr.deprecated
	};
}



function getLuaEngine(document?:vscode.TextDocument | undefined):string | undefined {
	if (document != undefined) {
		const str = "---@funkinEngine=";
		const line = getLineContentAt(document.getText(), document.getText().indexOf(str));
		if (line != null) {
			return line.trim().split("=")[1];
		}
	}
	return vscode.workspace.getConfiguration().get("funkinscriptautocomplete.luaEngine");
}