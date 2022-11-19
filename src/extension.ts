/* eslint-disable prefer-const */

// fucking shitty dependency system what the fuck this does not work
//import * as Color from 'color';
import * as vscode from 'vscode';

// import * from '.dataShit'  imagine
import { getFunctions,getFunction,getVariable,getVariables,getEvent,getEvents } from './dataShit';

export function activate(context: vscode.ExtensionContext) {
	//Suggest functions and variables
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		provideCompletionItems: function (document, position) {
			if (!isEnabled(document)) {
				return null;
			}

			let list:vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> = [];
			
			for (const _func in getFunctions(document)) {
				const func = getFunction(_func, document);
				if (func == null)
					continue;

				let markdownString = new vscode.MarkdownString();
				if (func.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + func.deprecated + "**\n\n");
				}
				markdownString.appendMarkdown(func.documentation);

				list.push({
					detail: func.returns + " " + func.name + "(" + func.args +")",
					kind: vscode.CompletionItemKind.Function,
					label: func.name,
					documentation: markdownString
				});
			}

			for (const _varia in getVariables(document)) {
				const varia = getVariable(_varia, document);
				if (varia == null)
					continue;

				list.push({
					detail: varia.returns + " " + varia.name,
					kind: vscode.CompletionItemKind.Variable,
					label: varia.name,
					documentation: new vscode.MarkdownString().appendMarkdown(varia.documentation)
				});
			}

			return list;
		}
	}));

	//Word hover event
	context.subscriptions.push(vscode.languages.registerHoverProvider("lua", {
		provideHover: function (document, position, token) {
			if (!isEnabled(document)) {
				return null;
			}

			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range);

			const func = getFunction(word, document);
			const varia = getVariable(word, document);
			const event = getEvent(word, document);
			
			const markdownString = new vscode.MarkdownString();
			let object:any = null;
			if (func != null) {
				if (func.deprecated != null) {
					markdownString.appendMarkdown("*@deprecated* **" + func.deprecated + "**\n\n");
				}
				markdownString.appendCodeblock("function " + func.name + "(" + func.args + ") -> " + func.returns);
				object = func;
			}
			if (varia != null) {
				markdownString.appendCodeblock("variable " + varia.name + " -> " + varia.returns);
				object = varia;
			}
			if (event != null) {
				markdownString.appendCodeblock("event " + event.name + "(" + event.args + ")" + " -> " + event.returns);
				object = event;
			}
			if (object != null) {
				markdownString.appendMarkdown(object.documentation);
				return new vscode.Hover(markdownString);
			}
		}
	}));
	
	//Suggest args for functions
	context.subscriptions.push(vscode.languages.registerSignatureHelpProvider("lua", {
		provideSignatureHelp: function (document, position, token) {
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
			const func = getFunction(word, document);

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
	}, '(', ',', ')'));

	//Suggest event snippets
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			if (!isEnabled(document)) {
				return null;
			}

			let list: vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> = [];

			for (const _event in getEvents(document)) {
				const event = getEvent(_event, document);
				if (event == null)
					continue;
				
				const snippet = new vscode.CompletionItem("Event: " + event.name + "()");
				snippet.insertText = new vscode.SnippetString("function " + event.name + "(" + haxeArgsToLua(event.args) + ")\n\nend");
				snippet.documentation = new vscode.MarkdownString(event.documentation);

				list.push(snippet);
			}

			return list;
		}
	}));

	/*
	// Show colors
	context.subscriptions.push(
		vscode.languages.registerColorProvider(
			"lua", 
			{
				// select the locations of colors
				provideDocumentColors(document, token) {
					let colorsList:vscode.ProviderResult<vscode.ColorInformation[]> = [];
					let i = 0;
					let isInType = 0;
					let curColorString = "";
					let isInString = false;

					let begS:vscode.Position | undefined = undefined;
					let endS:vscode.Position;
					
					while (i++ < document.getText().length) {
						const curChar = document.getText().charAt(i);
						if (curChar == "'" || curChar == '"') {
							if (!isInString) {
								isInString = true;
							}
							else {
								endS = document.positionAt(i);

								let color:Color = new Color(curColorString);
								
								if (begS != undefined)
									colorsList.push(
										new vscode.ColorInformation(new vscode.Range(begS, endS), new vscode.Color(color.red(), color.green(), color.blue(), color.alpha()))
									);

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
						new vscode.ColorPresentation(context.document.getText(context.range))
					];
				}
			}
		));
	*/

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

	const collection = vscode.languages.createDiagnosticCollection('fnfsac');
	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor || activeEditor.document.languageId != "lua") {
			return;
		}

		collection.clear();

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

			const func = getFunction(match[0], activeEditor.document);
			if (func != null && func.deprecated != null && activeEditor.document.getText().charAt(match.index + match[0].length) == "(") {
				const decoration: vscode.DecorationOptions = { range: new vscode.Range(startPos, endPos) };
				decorations.push(decoration);
				
				diagnostics.push({
					code: match[0],
					message: func.deprecated,
					range: new vscode.Range(startPos, endPos),
					severity: vscode.DiagnosticSeverity.Warning
				});
			}
		}
		collection.set(activeEditor.document.uri, diagnostics);
		activeEditor.setDecorations(warningDecorationType, decorations);
	}

	function triggerUpdateDecorations(throttle = false) {
		if (activeEditor && !isEnabled(activeEditor.document)) {
			collection.set(activeEditor.document.uri, []);
			activeEditor.setDecorations(warningDecorationType, []);
			return;
		}

		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 500);
		} else {
			updateDecorations();
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
		if (activeEditor && event.document === activeEditor.document) {
			triggerUpdateDecorations(true);
		}
	}, null, context.subscriptions);
}

function isEnabled(document:vscode.TextDocument) {
	if (vscode.workspace.getConfiguration().get("funkinscriptautocomplete.enableOnlyOnCertainScripts") && document.getText().indexOf("---@funkinScript") == -1) {
		return false;
	}
	return true;
}

function haxeArgsToLua(str:string) {
	//str = "sex:String, fuck:Int"
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
