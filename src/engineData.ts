import * as vscode from 'vscode';

import { getLineContentAt } from './util';
import * as needle from 'needle';
import { readFile, writeFile } from 'fs';
import { dataPath } from './extension';

const cachedJsons: Map<string, any> = new Map<string, any>();
const cachedFiles: Map<string, string> = new Map<string, string>();

export async function getData(file:string):Promise<string | any> {
	file = file.trim();

	if (file.endsWith(".ver")) {
		if (cachedFiles.has(file)) {
			return cachedFiles.get(file);
		}

		try {
			const response = await needle("get", "https://raw.githubusercontent.com/Snirozu/Funkin-Script-AutoComplete/master/data/" + file);
			if (response.statusCode == 200) {
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				writeFile(dataPath + file, response.body, err => { });
				cachedFiles.set(file, response.body);
				return response.body;
			}
		}
		catch (exc) {
			//console.log(exc);
		}

		readFile(dataPath + file, (err, data) => {
			if (!err) {
				cachedFiles.set(file, data.toString());
				return cachedFiles.get(file);
			}
		});
	}
	else if (file.endsWith(".json")) {
		if (cachedJsons.has(file)) {
			return cachedJsons.get(file);
		}

		try {
			const response = await needle("get", "https://raw.githubusercontent.com/Snirozu/Funkin-Script-AutoComplete/master/data/" + file);
			if (response.statusCode == 200) {
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				writeFile(dataPath + file, response.body, err => {});
				cachedJsons.set(file, JSON.parse(response.body));
				return cachedJsons.get(file);
			}
		}
		catch (exc) {
			//console.log(exc);
		}

		readFile(dataPath + file, (err, data) => {
			if (!err) {
				cachedJsons.set(file, JSON.parse(data.toString()));
				return cachedJsons.get(file);
			}
		});
	}
	return null;
}

export async function getEngineData(engine:string | undefined):Promise<any> {
	if (engine == undefined) throw "Extension couldn't find any engines...";

	engine = engine + (engine.endsWith("_latest") ? ".ver" : ".json");

	let data = await getData(engine);
	if (engine.endsWith(".ver")) {
		data = await getData(data + ".json");
	}

	return data;
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
	return vscode.workspace.getConfiguration().get("funkinvscode.luaEngine");
}