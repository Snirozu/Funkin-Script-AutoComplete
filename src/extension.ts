/* eslint-disable prefer-const */

//import * as Color from 'color';
import * as vscode from 'vscode';
import * as EngineData from './engineData';
import * as util from './util';
import { spawn, spawnSync } from 'child_process';
import path = require('path');
import { XMLParser } from "fast-xml-parser";
import { characterOffsetToByteOffset } from './util';
import { existsSync } from 'fs';

export let dataPath = "";

let diagnosticCollection: vscode.DiagnosticCollection;
let decorationCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
	dataPath = context.asAbsolutePath("./data/");

	diagnosticCollection = vscode.languages.createDiagnosticCollection('funkin_sac_diagnostics');
	decorationCollection = vscode.languages.createDiagnosticCollection('funkin_sac_decorations');
	context.subscriptions.push(diagnosticCollection);

	const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "a_", textNodeName: "nval" });

	// ======================
	// 			HAXE
	// ======================

	// tab/space completion
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('haxe', {
		provideCompletionItems: async function (document, position) {
			if (!document.fileName.endsWith(getHScriptExtension()))
				return;

			let list: vscode.CompletionItem[] = [];

			const output = await execCommand(document, position);
			if (!output)
				return;

			const xml = parser.parse(output);

			let ilst: Array<any> = (xml.il ?? xml.list).i;

			if (ilst)
				ilst.forEach((value) => {
					let item: vscode.CompletionItem = {
						label: value.a_n ?? value.nval + "" // professional way to convert to string
					};

					switch (value.a_k) {
						case "type":
							item.kind = vscode.CompletionItemKind.Class;
							if (value.a_p)
								item.insertText = value.a_p;
							break; //dead ass language needs breaks because why the fuck not?
						case "keyword":
							item.kind = vscode.CompletionItemKind.Keyword;
							break;
						case "package":
							item.kind = vscode.CompletionItemKind.Folder;
							break;
						case "member":
							item.kind = vscode.CompletionItemKind.Field;
							break; 
						case "method":
							item.kind = vscode.CompletionItemKind.Method;
							break;
						case "var":
							item.kind = vscode.CompletionItemKind.Property;
							break;
						case "literal":
							item.kind = vscode.CompletionItemKind.Value;
							break;
						case "enumabstract":
							item.kind = vscode.CompletionItemKind.EnumMember;
							break;
						case "static":
							item.kind = vscode.CompletionItemKind.Variable;
							break;
					}

					item.detail = value.a_p ?? value.a_t ?? value.t;

					let doc: string | undefined = value.a_d ?? value.d;
					if (doc) {
						doc = doc.split('\t').join('');
						doc = doc.split('\n *').join('\n');
						doc = doc.split('\n ').join('\n\n');
						if (doc.charAt(0) == "*") {
							doc = doc.substring(1);
						}
						//doc = doc.replace("\t", ""); // replace is broken???
						item.documentation = new vscode.MarkdownString(doc);
					}

					list.push(item);
				});

			return list;
		}
	}, '.'));

	// word hover event
	context.subscriptions.push(vscode.languages.registerHoverProvider("haxe", {
		provideHover: async function (document, position, token) {
			if (!document.fileName.endsWith(getHScriptExtension()))
				return;

			const range = document.getWordRangeAtPosition(position);
			if (!range)
				return;

			const output = await execCommand(document, position, "type");
			if (!output)
				return new vscode.Hover("Failed to complete!\nCheck PROBLEMS tab!");

			const xml = parser.parse(output);

			let dick = xml.type.a_d;
			if (dick) {
				dick = dick.split('\t').join('');
				dick = dick.split('\n *').join('\n');
				dick = dick.split('\n ').join('\n\n');
				if (dick.charAt(0) == "*") {
					dick = dick.substring(1);
				}
			}

			let hoverMd = new vscode.MarkdownString();
			hoverMd.appendMarkdown("`" + xml.type.nval + "`\n\n");
			if (dick) {
				hoverMd.appendMarkdown("---\n\n");
				hoverMd.appendMarkdown(dick + "\n\n");
			}
			return new vscode.Hover(hoverMd);
		}
	}));

	//jump to definitions of identifiers!
	context.subscriptions.push(vscode.languages.registerDefinitionProvider('haxe', {
		async provideDefinition(document, position, token) {
			if (!document.fileName.endsWith(getHScriptExtension()))
				return;

			const range = document.getWordRangeAtPosition(position);
			if (!range)
				return;

			const output = await execCommand(document, position, "position");
			if (!output)
				return;

			const xml = parser.parse(output);

			//spaghetti code, please don't look 👉👈
			const destSplit = (xml.list.pos as string).replace(getHScriptExtension() + ":", ".hx:").split(".hx:");
			const destPath = destSplit[0] + ".hx" + ((xml.list.pos as string).indexOf(getHScriptExtension() + ":") != -1 ? "c" : "");
			const destSplat = destSplit[1].replace(" character ", " characters ").split(": characters ");
			const destPos = new vscode.Position(Number.parseInt(destSplat[0]) - 1, Number.parseInt(destSplat[1].split("-")[0]) - 1);

			return new vscode.Location(vscode.Uri.file(destPath), destPos);
		},
	}));

	context.subscriptions.push(vscode.commands.registerCommand("funkinvscode.updatelibs", _ => {
		updateLibs(vscode.window.activeTerminal ?? vscode.window.createTerminal());
	}));

	context.subscriptions.push(vscode.commands.registerCommand("funkinvscode.updatelibsnofunkin", _ => {
		updateLibs(vscode.window.activeTerminal ?? vscode.window.createTerminal(), 'funkin');
	}));

	context.subscriptions.push(vscode.commands.registerCommand("funkinvscode.updatefunkin", _ => {
		updateLib('funkin', vscode.window.activeTerminal ?? vscode.window.createTerminal());
	}));

	// ======================
	// 			LUA
	// ======================

	//Suggest functions and variables
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		//executed every time the user requests tab completion
		provideCompletionItems: async function (document, position) {
			//list of items to append into the tab completer
			let list:vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> = [];

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
				documentation: "Set the FNF engine",
				kind: vscode.CompletionItemKind.Snippet,
				label: "---@funkinEngine="
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

				let labelArgs:Array<string> = [];
				let completeArgs:Array<string> = [];
				const doInsertArguments = vscode.workspace.getConfiguration().get("funkinvscode.functionArgumentsGeneration");
				const args = getArgArgParts(func.args);
				args.forEach((arg, _) => {
					labelArgs.push(arg.name);
					if (!arg.optional)
						completeArgs.push(arg.default);
				});

				list.push({
					detail: func.returns + " " + func.name + "(" + func.args +")",
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
			let object:any = null;
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
				markdownString.appendMarkdown("**FNF Engine Event/Trigger Function**\n\n" + event.documentation);
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
			let lastCharPos:vscode.Position | null = null;
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

			const spltArgs:Array<string> = func.args.split(",");
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
				let daArgs:Array<string> = [];

				const args = getArgArgParts(event.args);
				const doAppendComments = vscode.workspace.getConfiguration().get("funkinvscode.eventDocumentationGeneration");
				let daComment:string = doAppendComments && args.length > 0 ? "---" : "";
				args.forEach((arg, i) => {
					if (doAppendComments) {
						daComment += "\n--- @param " + arg.name + " " + arg.type;
					}
					daArgs.push(arg.name);
				});

				if (doAppendComments && args.length > 0) {
					daComment += "\n---\n";
				}
				
				const snippet = new vscode.CompletionItem("Event: " + event.name + "(" + daArgs.join(", ") + ")");
				snippet.detail = event.name + "(" + event.args + ")";
				snippet.insertText = new vscode.SnippetString(daComment + "function " + event.name + "(" + haxeArgsToLua(event.args) + ")\n\t$0\nend");
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
	context.subscriptions.push(
		vscode.languages.registerColorProvider(
			"lua", 
			{
				// select the locations of colors
				provideDocumentColors(document, token) {
					let colorsList:vscode.ProviderResult<vscode.ColorInformation[]> = [];
					let i = -1;
					let isInType = 0;
					let curColorString = "";
					let isInString = false;

					let begS:vscode.Position | undefined = undefined;
					let endS:vscode.Position;
					
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

	//https://github.com/microsoft/vscode/issues/187141 // I NEEED ITTTT!!!!!
}

function isEnabled(document:vscode.TextDocument) {
	if (vscode.workspace.getConfiguration().get("funkinvscode.enableOnlyOnCertainScripts") && document.getText().indexOf("---@funkinScript") == -1) {
		return false;
	}
	return true;
}

function haxeArgsToLua(str:string) {
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

function getArgArgParts(argsString:string):Array<SexyArg> {
	let args:Array<SexyArg> = [];

	// argString = " arg1:String = null"
	argsString.split(",").forEach((argString) => {
		let arg:SexyArg = {
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

function getDefaultValue(type:string):string {
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
	name:string,
	type:string,
	default:string,
	optional:boolean
}

async function showWarnings(output: string) {
	if (!output)
		return;

	if (output == "Please Install Haxe!") { 
		const selection = await vscode.window.showErrorMessage(output + "\nTo use .hxc completion you need to install Haxe first!", 'Download Haxe');

		if (selection == "Download Haxe") {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://haxe.org/download/'));
		}
		return;
	}

	if (output.startsWith("Error: ")) {
		if (output.includes(" is not installed")) {
			const selection = await vscode.window.showErrorMessage(output, 'Install Library');

			if (selection == "Install Library") {
				const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();
				const lib = output.split("Library ")[1].split(" is not installed")[0];

				updateLib(lib, terminal);
			}
		}
	}

	let warns: Map<string, vscode.Diagnostic[]> = new Map();
	for (const warn of output.split('\n')) {
		let i = -1;
		let parseString = "";
		let phase = 0;

		let path = "";
		let line = 0;
		let chars: number[] = [];
		let message = "";
		let isWarning = false;

		while (++i <= warn.length - 1) {
			const char = warn.charAt(i);
			const nextChar = warn.charAt(i + 1);

			if (char == ":" && (nextChar == "/" || nextChar == "\\")) {
				parseString += char;
				continue;
			}

			switch (phase) {
				case 0: //path
					if (char == ":") {
						path = parseString;
						parseString = "";
						phase++;
						continue;
					}
					break;
				case 1: //line
					if (char == ":") {
						line = Number.parseInt(parseString) - 1;
						parseString = "";
						phase++;
						continue;
					}
					break;
				case 2: //characters
					if (char == " ")
						continue;

					if (parseString == "character" || parseString == "characters") {
						parseString = "";
						continue;
					}

					if (char == "-") {
						chars.push(Number.parseInt(parseString) - 1);
						parseString = "";
						continue;
					}

					if (char == ":") {
						chars.push(Number.parseInt(parseString) - 1);
						parseString = "";
						phase++;
						continue;
					}
					break;
				case 3:
					if (parseString == " Warning :") {
						isWarning = true;
						parseString = "";
					}
			}

			parseString += char;
		}
		message = parseString.trim();

		if (!warns.has(path)) {
			warns.set(path, []);
		}

		warns.get(path).push({
			message: message,
			severity: isWarning ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error,
			range: new vscode.Range(
				new vscode.Position(line, chars[0]),
				new vscode.Position(line, chars[1])
			)
		});
	}

	diagnosticCollection.clear();
	for (const warn of warns) {
		diagnosticCollection.set(vscode.Uri.file(warn[0]), warn[1]);
	}
}

async function execCommand(document: vscode.TextDocument, position: vscode.Position, mode?: string) {
	await document.save();

	const fileNam = document.uri.path.substring(document.uri.path.length - path.basename(document.uri.path).length);
	const fileDir = document.uri.path.substring(document.uri.path.charAt(2) == ":" ? 1 : 0, document.uri.path.length - path.basename(document.uri.path).length);

	if (mode)
		mode = "@" + mode;
	else
		mode = "";

	let libs:Array<string> = [];

	(vscode.workspace.getConfiguration().get("funkinvscode.haxelibs") as Array<string>).forEach(async lib => {
		libs.push('-L', lib.split(" ")[0]);
	});

	const testSpawn = spawnSync('haxe', ['--connect', '6000']);

	if (testSpawn.error && testSpawn.error.message.endsWith("ENOENT")) {
		return "Please Install Haxe!";
	}

	if (testSpawn.output.toString().includes('Couldn\'t connect on')) {
		spawn('haxe', ['--wait', '6000']);
	}

	let funkinPath = spawnSync('haxelib', ['path', 'funkin']).output.join("").split("\n")[0];
	if (funkinPath.startsWith("Error:")) {
		const selection = await vscode.window.showErrorMessage("\nTo use the completion you need to setup Funkin directory first!", 'Install Library');

		if (selection == "Install Library") {
			vscode.commands.executeCommand('funkinvscode.updatefunkin');
		}
		return;
	}
	const funkinSource = funkinPath.split("\\").join("/").trim();
	funkinPath = funkinSource.substring(0, funkinPath.length - 'source'.length - 2);

	//<haxeflag name="--macro" value="addMetadata('@:build(funkin.util.macro.FlxMacro.buildFlxBasic())', 'flixel.FlxBasic')" />

	let _output = spawnSync('haxe', ['--display', fileNam + '@' + characterOffsetToByteOffset(document.getText(), document.offsetAt(position)) + mode, 
		'--no-output', 
		'--cpp', '_', 
		'--connect', '6000', 
		'--remap', 'flash:openfl', 
		'--macro flixel.system.macros.FlxDefines.run()',
		'--macro haxe.macro.Compiler.addClassPath("' + funkinPath + '")',
		'--macro haxe.macro.Compiler.addClassPath("' + funkinSource + '")',
		'-D FLX_KEYBOARD',
		'-D haxeui_dont_impose_base_class'
	].concat(libs), { cwd: fileDir }).output.join("");

	const mesSplit = _output.split("\n<");
	let warnings = mesSplit.shift();
	let rpc = mesSplit.join('<');

	if (warnings && warnings.charAt(0) == "<") {
		rpc = warnings + rpc;
		warnings = undefined;
	}

	if (rpc.length > 0 && rpc.charAt(0) != "<") {
		rpc = "<" + rpc;
	}

	console.log(warnings);
	console.log(rpc);

	showWarnings(warnings);
	if (rpc.length < 1)
		return;
	return rpc;
}

function getHScriptExtension():string {
	return "." + vscode.workspace.getConfiguration().get("funkinvscode.hscriptFileExtension") as string;
}

function updateLib(lib:string, terminal:vscode.Terminal) {
	let swagCommand = "haxelib install " + lib;
	(vscode.workspace.getConfiguration().get("funkinvscode.haxelibs") as Array<string>).forEach(clib => {
		const libProps = clib.split(" ");
		if (libProps[0] == lib && libProps[1]) {
			if (libProps[1].startsWith("http")) {
				swagCommand = "haxelib git " + libProps[0] + " " + libProps[1];
				if (libProps[2]) {
					swagCommand += " " + libProps[2];
					if (libProps[3]) {
						swagCommand += " " + libProps[3];
						if (libProps[4]) {
							swagCommand += " " + libProps[4];
						}
					}
				}

			}
			else {
				if (existsSync(libProps[1])) {
					swagCommand = "haxelib dev " + libProps[0] + " " + libProps[1];
				}
				else {
					swagCommand = "haxelib install " + libProps[0] + " " + libProps[1];
				}
			}
		}
	});

	terminal.sendText(swagCommand);
}

function updateLibs(terminal: vscode.Terminal, ignore?:string) {
	let commands:Array<string> = [];
	(vscode.workspace.getConfiguration().get("funkinvscode.haxelibs") as Array<string>).forEach(clib => {
		const libProps = clib.split(" ");
		let swagCommand = "haxelib install " + libProps[0];
		if (libProps[1]) {
			if (libProps[1].startsWith("http")) {
				swagCommand = "haxelib git " + libProps[0] + " " + libProps[1];
				if (libProps[2]) {
					swagCommand += " " + libProps[2];
					if (libProps[3]) {
						swagCommand += " " + libProps[3];
						if (libProps[4]) {
							swagCommand += " " + libProps[4];
						}
					}
				}

			}
			else {
				if (existsSync(libProps[1])) {
					swagCommand = "haxelib dev " + libProps[0] + " " + libProps[1];
				}
				else {
					swagCommand = "haxelib install " + libProps[0] + " " + libProps[1];
				}
			}
		}

		if (libProps[0] != ignore)
			commands.push(swagCommand);
	});
	terminal.sendText(commands.join(";"));
}