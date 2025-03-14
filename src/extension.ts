/* eslint-disable prefer-const */

//import * as Color from 'color';
import * as vscode from 'vscode';
import * as EngineData from './engineData';
import * as util from './util';
import { existsSync } from 'fs';
import { activateHx } from './extensionHx';

export let dataPath = "";

export let diagnosticCollection: vscode.DiagnosticCollection;
export let decorationCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {

	let path = vscode.workspace.getConfiguration().get<string>("funkinVSCode.data") || "./data/";

	dataPath = context.asAbsolutePath(path);

	// If path is not relative
	if (!existsSync(dataPath))
		dataPath = path;

	diagnosticCollection = vscode.languages.createDiagnosticCollection('funkin_sac_diagnostics');
	decorationCollection = vscode.languages.createDiagnosticCollection('funkin_sac_decorations');
	outputChannel = vscode.window.createOutputChannel('Funkin VSCode DLogs');
	context.subscriptions.push(diagnosticCollection);

	// activate haxe completion
	if (vscode.workspace.getConfiguration().get("funkinVSCode.haxeEnabled")) {
		activateHx(context);
	}

	// ======================
	// 			LUA
	// ======================

	//Suggest functions and variables
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		//executed every time the user requests tab completion
		provideCompletionItems: async function (document, position) {
			//list of items to append into the tab completer
			let list: vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> = [];

			if (!isEnabled(document)) {
				list.push({
					documentation: "Enable FNF Script AutoCompleting in this file",
					kind: vscode.CompletionItemKind.Snippet,
					label: "---@funkinScript"
				});

				return list;
			}

			list.push({
				detail: "---@funkinEngine={engine}",
				documentation: "Set the FNF engine for this script.",
				kind: vscode.CompletionItemKind.Snippet,
				label: "funkinEngine=",
				insertText: new vscode.SnippetString("---@funkinEngine=$0")
			});

			//add function
			for (const _func in await EngineData.getFunctions(document)) {
				const func = await EngineData.getFunction(_func, document);
				if (func == null)
					continue;

				let markdownString = new vscode.MarkdownString();
				if (func.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + func.deprecated + "**\n\n");
					// TODO i give up with this shit, help
					//func.name = "~~" + func.name + "~~";
				}
				markdownString.appendMarkdown(func.documentation);

				let labelArgs: Array<string> = [];
				let completeArgs: Array<string> = [];
				const doInsertArguments = vscode.workspace.getConfiguration().get("funkinVSCode.functionArgumentsGeneration");
				const args = getArgArgParts(func.args);
				args.forEach((arg, _) => {
					labelArgs.push(arg.name);
					if (!arg.optional)
						completeArgs.push(arg.default);
				});

				list.push({
					detail: func.returns + " " + func.name + "(" + func.args + ")",
					kind: vscode.CompletionItemKind.Function,
					label: func.name + "(" + labelArgs.join(", ") + ")",
					insertText: new vscode.SnippetString(func.name + "(" + (doInsertArguments ? completeArgs.join(", ") : "") + "$0)"),
					command: {
						title: "complete",
						command: "editor.action.triggerParameterHints"
					},
					documentation: markdownString
				});
			}

			//add variables
			for (const _varia in await EngineData.getVariables(document)) {
				const varia = await EngineData.getVariable(_varia, document);
				if (varia == null)
					continue;

				let markdownString = new vscode.MarkdownString();
				if (varia.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + varia.deprecated + "**\n\n");
				}
				markdownString.appendMarkdown(varia.documentation);

				list.push({
					detail: varia.returns + " " + varia.name,
					kind: vscode.CompletionItemKind.Variable,
					label: varia.name,
					documentation: markdownString
				});
			}

			return list;
		}
	}));

	//Word hover event
	context.subscriptions.push(vscode.languages.registerHoverProvider("lua", {
		provideHover: async function (document, position, token) {
			if (!isEnabled(document)) {
				return null;
			}

			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range);

			const func = await EngineData.getFunction(word, document);
			const varia = await EngineData.getVariable(word, document);
			const event = await EngineData.getEvent(word, document);

			const markdownString = new vscode.MarkdownString();
			let object: any = null;
			if (func != null) {
				if (func.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + func.deprecated + "**\n\n");
				}
				markdownString.appendCodeblock("function " + func.name + "(" + func.args + "): " + func.returns);
				object = func;
			}
			if (varia != null) {
				if (varia.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + varia.deprecated + "**\n\n");
				}
				markdownString.appendCodeblock(varia.name + ": " + varia.returns);
				object = varia;
			}
			/*
			generate the function comment instead

			if (event != null) {
				markdownString.appendCodeblock("event " + event.name + "(" + event.args + "): " + event.returns);
				object = event;
			}
			*/
			if (event != null) {
				markdownString.appendMarkdown("**Engine Event/Trigger Function**\n\n" + event.documentation);
				return new vscode.Hover(markdownString);
			}
			if (object != null) {
				markdownString.appendMarkdown(object.documentation);
				return new vscode.Hover(markdownString);
			}
		}
	}));

	//Suggest args for functions (broken)
	context.subscriptions.push(vscode.languages.registerSignatureHelpProvider("lua", {
		provideSignatureHelp: async function (document, position, token) {
			if (!isEnabled(document)) {
				return null;
			}

			let i = document.offsetAt(position);
			let lastCharPos: vscode.Position | null = null;
			let numArgs = 0;
			while (i > 0) {
				const bch = document.getText().charAt(i - 1);
				const ch = document.getText().charAt(i);
				if (ch == ",") {
					numArgs++;
				}
				if (ch.replace(/\s/g, "") != "") {
					lastCharPos = document.positionAt(i);
				}
				if (bch == ";" || bch == ")" || bch == null) {
					break;
				}
				i--;
			}
			if (lastCharPos == null) {
				return;
			}

			const range = document.getWordRangeAtPosition(lastCharPos, /[a-zA-Z]+/g);
			let word = document.getText(range);
			const func = await EngineData.getFunction(word, document);

			if (func == null)
				return;

			const provider = new vscode.SignatureHelp;
			provider.activeParameter = 0;
			provider.activeSignature = numArgs;

			const spltArgs: Array<string> = func.args.split(",");
			let _i = 0;
			for (let arg in spltArgs) {
				provider.signatures.push({
					label: spltArgs[arg],
					parameters: []
				});
				//argsString.appendMarkdown((_i == numArgs ? "<blue>" : "") + arg + (_i == numArgs ? "</blue>" : "") + (_i == spltArgs.length - 1 ? "" : ", "));
				_i++;
			}

			return provider;
		}
	}, '(', ','));

	//Suggest event snippets
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			if (!isEnabled(document)) {
				return null;
			}

			let list: vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> = [];

			for (const _event in await EngineData.getEvents(document)) {
				const event = await EngineData.getEvent(_event, document);
				if (event == null)
					continue;

				//let daComment = "---\n---" + event.documentation + "\n---";
				let daArgs: Array<string> = [];

				const args = getArgArgParts(event.args);
				const doAppendComments = vscode.workspace.getConfiguration().get("funkinVSCode.eventDocumentationGeneration");
				let daComment: string = doAppendComments && args.length > 0 ? "---" : "";
				args.forEach((arg, i) => {
					if (doAppendComments) {
						daComment += "\n--- @param " + arg.name + " " + arg.type;
					}
					daArgs.push(arg.name);
				});

				if (doAppendComments && args.length > 0) {
					daComment += "\n---\n";
				}

				const includeCode = (event.returns && (
					(event.returns + '').startsWith("array") || 
					(event.returns + '').startsWith("bool") || 
					event.returns == "float" || 
					event.returns == "int" ||
					event.returns == "number" || 
					event.returns == "string"
				)) ? 'return ' : '';

				const snippet = new vscode.CompletionItem("Event: " + event.name + "(" + daArgs.join(", ") + ")");
				snippet.detail = event.returns + " " + event.name + "(" + event.args + ")";
				snippet.insertText = new vscode.SnippetString(daComment + "function " + event.name + "(" + haxeArgsToLua(event.args) + ")\n\t" + includeCode + "$0\nend");
				snippet.documentation = new vscode.MarkdownString(event.documentation);
				snippet.command = {
					title: "complete",
					command: "editor.action.triggerSuggest"
				};

				list.push(snippet);
			}

			return list;
		}
	}));

	// Show colors
	context.subscriptions.push(vscode.languages.registerColorProvider("lua",
		{
			// select the locations of colors
			provideDocumentColors(document, token) {
				let colorsList: vscode.ProviderResult<vscode.ColorInformation[]> = [];
				let i = -1;
				let isInType = 0;
				let curColorString = "";
				let isInString = false;

				let begS: vscode.Position | undefined = undefined;
				let endS: vscode.Position;

				while (i++ < document.getText().length - 1) {
					const curChar = document.getText().charAt(i);
					if (curChar == "'" || curChar == '"') {
						if (!isInString) {
							isInString = true;
						}
						else {
							endS = document.positionAt(i);

							//let color:Color = new Color(curColorString);

							if (begS != undefined) {
								const color = util.hexToVSColor(curColorString);

								if (color != null)
									colorsList.push(
										new vscode.ColorInformation(new vscode.Range(begS, endS), color)
									);
							}

							isInString = false;
							isInType = 0;
							curColorString = "";
						}
					}

					if (isInString) {
						if (curChar == "#") {
							begS = document.positionAt(i);
							isInType = 1;
						}

						if (isInType > 0) {
							curColorString += curChar;
						}
					}
				}
				return colorsList;
			},
			// show the color picker
			provideColorPresentations(color, context, token) {
				return [
					new vscode.ColorPresentation(util.rgbaToHex(color.red, color.green, color.blue, color.alpha))
				];
			}
		}
	));

	context.subscriptions.push(vscode.commands.registerCommand("funkinVSCode.clearCache", _ => {
		EngineData.CACHED.clear();
	}));

	//deprecated warnings here
	//copied from some example lmao
	let timeout: NodeJS.Timer | undefined = undefined;

	const warningDecorationType = vscode.window.createTextEditorDecorationType({
		textDecoration: "line-through",
		light: {
			backgroundColor: "#ffff57"
		},
		dark: {
			backgroundColor: "#5e5e29"
		}
	});

	let activeEditor = vscode.window.activeTextEditor;

	async function updateDecorations() {
		if (!activeEditor || activeEditor.document.languageId != "lua") {
			return;
		}

		decorationCollection.clear();

		const regEx = /[a-zA-Z]+/g;
		const text = activeEditor.document.getText();
		const decorations: vscode.DecorationOptions[] = [];
		let diagnostics: vscode.Diagnostic[] = [];

		let match;
		while ((match = regEx.exec(text))) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);

			let doContinue = false;

			if (startPos.line - 1 >= 0) {
				let prevLine = activeEditor.document.lineAt(startPos.line - 1).text;
				if (prevLine.includes("---@diagnostic disable-next-line:") && prevLine.substring(prevLine.indexOf(":")).includes(match[0]))
					doContinue = true;
			}

			let firstFileDiagnComment = activeEditor.document.getText().indexOf("---@diagnostic disable:");
			if (firstFileDiagnComment >= 0 && activeEditor.document.lineAt(activeEditor.document.positionAt(firstFileDiagnComment).line).text.includes(match[0]))
				doContinue = true;

			if (doContinue)
				continue;

			const func = await EngineData.getFunction(match[0], activeEditor.document);
			const event = await EngineData.getEvent(match[0], activeEditor.document);
			const varr = await EngineData.getFunction(match[0], activeEditor.document);

			let deprecatedMsg = null;
			if (func != null && func.deprecated != null)
				deprecatedMsg = func.deprecated;
			if (event != null && event.deprecated != null)
				deprecatedMsg = event.deprecated;
			if (varr != null && varr.deprecated != null)
				deprecatedMsg = varr.deprecated;

			if (deprecatedMsg != null && (varr != null && varr.deprecated != null) && activeEditor.document.getText().charAt(match.index + match[0].length) == "(") {
				const decoration: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };
				decorations.push(decoration);

				diagnostics.push({
					code: match[0],
					message: deprecatedMsg,
					range: new vscode.Range(startPos, endPos),
					severity: vscode.DiagnosticSeverity.Warning
				});
			}
		}
		decorationCollection.set(activeEditor.document.uri, diagnostics);
		activeEditor.setDecorations(warningDecorationType, decorations);
	}

	async function triggerUpdateDecorations(throttle = false) {
		if (!activeEditor || !activeEditor.document.fileName.endsWith(".lua")) {
			return;
		}

		if (activeEditor && !isEnabled(activeEditor.document)) {
			decorationCollection.set(activeEditor.document.uri, []);
			activeEditor.setDecorations(warningDecorationType, []);
			return;
		}

		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 5000);
		} else {
			await updateDecorations();
		}
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		activeEditor = editor;
		if (editor) {
			triggerUpdateDecorations();
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		diagnosticCollection.clear();
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('funkinVSCode.offlineMode') || event.affectsConfiguration('funkinVSCode.onlineDataURL')) {
			EngineData.CACHED.clear();
		}
	}, null, context.subscriptions);

	//https://github.com/microsoft/vscode/issues/187141 // I NEEED ITTTT!!!!!
}

function isEnabled(document: vscode.TextDocument) {
	if (vscode.workspace.getConfiguration().get("funkinVSCode.enableOnlyOnCertainScripts") && document.getText().indexOf("---@funkinScript") == -1) {
		return false;
	}
	return true;
}

function haxeArgsToLua(str: string) {
	let finalString = "";
	let i = -1;
	let searchedString = "";
	while (i++ < str.length) {
		searchedString += str.charAt(i);
		if (str.charAt(i) == "," || i == str.length - 1) {
			const splittedString = searchedString.split(":");
			finalString += splittedString[0].trim() + (i == str.length - 1 ? "" : ", ");
			searchedString = "";
		}
	}

	return finalString;
}

function getArgArgParts(argsString: string): Array<SexyArg> {
	let args: Array<SexyArg> = [];

	// argString = " arg1:String = null"
	argsString.split(",").forEach((argString) => {
		let arg: SexyArg = {
			name: "(the program fucked up)",
			type: "nil",
			default: "",
			optional: false
		};

		if (argString.trim() != "") {
			const cachSplit1 = argString.split(":");

			arg.name = cachSplit1[0].trim();

			if (cachSplit1[0].startsWith("?")) {
				arg.optional = true;
			}

			if (cachSplit1.length > 1) {
				const cachSplit2 = cachSplit1[1].split("=");
				arg.type = cachSplit2[0].trim().toLowerCase();

				if (cachSplit2.length > 1) {
					arg.optional = true;
					arg.default = cachSplit2[1].trim().toLowerCase();
				}
				else {
					arg.default = getDefaultValue(arg.type);
				}
			}

			args.push(arg);
		}
	});

	return args;
}

function getDefaultValue(type: string): string {
	type = type.toLowerCase();
	if (type.startsWith("string")) {
		return '""';
	}
	if (type.startsWith("array")) {
		return '{}';
	}
	if (type.startsWith("int")) {
		return '0';
	}
	if (type.startsWith("float")) {
		return '0.0';
	}
	return "nil";
}

interface SexyArg {
	name: string,
	type: string,
	default: string,
	optional: boolean
}

let hasShownOutput = false;
export function sendToOutput(string: string) {
	if (!hasShownOutput) {
		outputChannel.show();
		hasShownOutput = true;
	}
	outputChannel.appendLine(string);
}