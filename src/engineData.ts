import * as vscode from 'vscode';

import { getLineContentAt } from './util';
import * as needle from 'needle';
import { readFile, writeFile } from 'fs';
import { dataPath, sendToOutput } from './extension';

// ========================
// 			ENGINE
// ========================
const ENGINE_SET = "---@funkinEngine=";
const USER_DEFINED_ENGINE = "funkinvscode.engine";

function getLuaEngine(document?: vscode.TextDocument | undefined): string | undefined {
	// If document selected
	if (document != undefined) {
		const text = document.getText();
		const index = text.indexOf(ENGINE_SET);

		// If specified, take the engine
		if (index != -1)
			return getLineContentAt(text, index).trim().split("=")[1];
	}

	return vscode.workspace.getConfiguration().get(USER_DEFINED_ENGINE);
}

// ======================
// 			DATA
// ======================
const CACHED: Map<string, any> = new Map<string, any>();
const REPOSITORY_DATA_URL = "https://raw.githubusercontent.com/Snirozu/Funkin-Script-AutoComplete/master/data/";

export async function getData(file: string): Promise<string | any> {
	file = file.trim();

	// If cached, skip
	if (CACHED.has(file))
		return CACHED.get(file);

	let content = await getOnlineData(file);

	// If found, skip
	if (content !== undefined)
		return content;

	// If not found, read from file
	readFile(dataPath + file, (err, data) => {

		// If error
		if (err) {
			sendToOutput("Errro while reading file: " + err.message);
			return {};
		}

		content = JSON.parse(data.toString());

		CACHED.set(file, content);
		return content;
	});

	return {};
}

async function getOnlineData(file: string): Promise<any | undefined> {

	const response = await needle("get", REPOSITORY_DATA_URL + file);

	// If failed, skip
	if (response.statusCode != 200)
		return undefined;

	// Write to file
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	writeFile(dataPath + file, response.body, () => { });

	const content = file.endsWith(".ver")
		? response.body
		: JSON.parse(response.body);

	CACHED.set(file, content);

	return content;
}

export async function getEngineData(document?: vscode.TextDocument): Promise<any> {

	let engine = getLuaEngine(document);

	// If no engine defined
	if (engine == undefined)
		throw "Extension couldn't find any engines...";

	engine = engine + (engine.endsWith("_latest") ? ".ver" : ".json");

	// Fetch data
	let data = await getData(engine);

	if (engine.endsWith(".ver"))
		data = await getData(data + ".json");

	return data;
}

// ===========================
// 			FUNCTIONS
// ===========================
export async function getFunctions(document?: vscode.TextDocument): Promise<any | undefined> {
	return (await getEngineData(document)).functions;
}

export async function getFunction(func: string, document?: vscode.TextDocument): Promise<any | null> {
	const functions = await getFunctions(document);

	if (functions === undefined)
		return null;

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

// ========================
// 			EVENTS
// ========================
export async function getEvents(document?: vscode.TextDocument): Promise<any | undefined> {
	return (await getEngineData(document)).events;
}

export async function getEvent(event: string, document?: vscode.TextDocument) : Promise<any | null> {
	const events = await getEvents(document);

	if (events === undefined)
		return null;

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

// ===========================
// 			VARIABLES
// ===========================
export async function getVariables(document?: vscode.TextDocument): Promise<any> {
	return (await getEngineData(document)).variables;
}

export async function getVariable(varia: string, document?: vscode.TextDocument) : Promise<any | null> {
	const variables = await getVariables(document);

	if (variables === undefined)
		return null;

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