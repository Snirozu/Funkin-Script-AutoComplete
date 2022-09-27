/* eslint-disable prefer-const */
import * as vscode from 'vscode';

// import * from '.dataShit'  imagine
import { getFunctions,getFunction,getVariable,getVariables,getEvent,getEvents } from './dataShit';

export function activate(context: vscode.ExtensionContext) {
	//Suggest functions and variables
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		provideCompletionItems: function (document, position) {
			let list = [];
			
			for (const _func in getFunctions()) {
				const func = getFunction(_func);
				if (func == null)
					continue;

				list.push({
					detail: func.returns + " " + func.name + "(" + func.args +")",
					kind: vscode.CompletionItemKind.Function,
					label: func.name,
					documentation: new vscode.MarkdownString().appendMarkdown(func.documentation)
				});
			}

			for (const _varia in getVariables()) {
				const varia = getVariable(_varia);
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
			const range = document.getWordRangeAtPosition(position);
			const word = document.getText(range);

			const func = getFunction(word);
			const varia = getVariable(word);
			const event = getEvent(word);

			if (func != null) {
				const markdownString = new vscode.MarkdownString();

				markdownString.appendCodeblock("function " + func.name + "(" + func.args + ") -> " + func.returns);
				markdownString.appendMarkdown(func.documentation);

				return new vscode.Hover(markdownString);
			}
			if (varia != null) {
				const markdownString = new vscode.MarkdownString();

				markdownString.appendCodeblock("variable " + varia.name + " -> " + varia.returns);
				markdownString.appendMarkdown(varia.documentation);

				return new vscode.Hover(markdownString);
			}
			if (event != null) {
				const markdownString = new vscode.MarkdownString();

				markdownString.appendCodeblock("event " + event.name + "(" + event.args + ")" + " -> " + event.returns);
				markdownString.appendMarkdown(event.documentation);

				return new vscode.Hover(markdownString);
			}
		}
	}));
	
	//Suggest args for functions
	context.subscriptions.push(vscode.languages.registerSignatureHelpProvider("lua", {
		provideSignatureHelp: function (document, position, token) {
			const range = document.getWordRangeAtPosition(position);
			let word = document.getText(range);
			word = word.substring(0, document.getText(range).length - 2);
			const func = getFunction(word);

			if (func == null)
				return;

			const provider = new vscode.SignatureHelp;
			provider.activeParameter = 0;
			provider.activeSignature = 0;

			provider.signatures.push(new vscode.SignatureInformation(func.args));

			return provider;
		}
	}, '(', ','));

	//Suggest event snippets
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lua', {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			let list = [];

			for (const _event in getEvents()) {
				const event = getEvent(_event);
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
