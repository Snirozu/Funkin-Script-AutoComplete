/* eslint-disable prefer-const */
import * as vscode from 'vscode';
import { XMLParser } from "fast-xml-parser";
import { spawn, spawnSync } from 'child_process';
import path = require('path');
import { characterOffsetToByteOffset } from './util';
import { diagnosticCollection, sendToOutput } from './extension';
import { existsSync } from 'fs';

export async function activateHx(context: vscode.ExtensionContext) {
	
	// ======================
	// 			HAXE
	// ======================

	const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "a_", textNodeName: "nval" });

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

	context.subscriptions.push(vscode.commands.registerCommand("funkinVSCode.updatelibs", _ => {
		updateLibs(vscode.window.activeTerminal ?? vscode.window.createTerminal());
	}));

	context.subscriptions.push(vscode.commands.registerCommand("funkinVSCode.updatelibsnofunkin", _ => {
		updateLibs(vscode.window.activeTerminal ?? vscode.window.createTerminal(), 'funkin');
	}));

	context.subscriptions.push(vscode.commands.registerCommand("funkinVSCode.updatefunkin", _ => {
		updateLib('funkin', vscode.window.activeTerminal ?? vscode.window.createTerminal());
	}));
}

async function showWarnings(output: string) {
	if (!output)
		return;

	sendToOutput(output);

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

	let libs: Array<string> = [];

	(vscode.workspace.getConfiguration().get("funkinVSCode.haxelibs") as Array<string>).forEach(async lib => {
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
			vscode.commands.executeCommand('funkinVSCode.updatefunkin');
		}
		return;
	}
	const funkinSource = funkinPath.split("\\").join("/").trim();
	funkinPath = funkinSource.substring(0, funkinPath.length - 'source'.length - 2);

	//<haxeflag name="--macro" value="addMetadata('@:build(funkin.util.macro.FlxMacro.buildFlxBasic())', 'flixel.FlxBasic')" />

	//the issue with completion as of now is
	// haxeui is not able to load the `module.xml` file for some reason

	let _output = spawnSync('haxe', ['--display', fileNam + '@' + characterOffsetToByteOffset(document.getText(), document.offsetAt(position)) + mode,
		'--no-output',
		'--cpp', '_',
		'--connect', '6000',
		'--remap', 'flash:openfl',
		'--macro flixel.system.macros.FlxDefines.run()',
		'--macro haxe.macro.Compiler.addClassPath("' + funkinPath + '")',
		'--macro haxe.macro.Compiler.addClassPath("' + funkinSource + '")',
		'-D FLX_KEYBOARD',
		'-D FLX_SOUND_TRAY',
		'-D FLX_MOUSE',
		'-D FLX_SOUND_SYSTEM',
		'-D FLX_SAVE',
		'-D FLX_JOYSTICK_API',
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

	showWarnings(warnings);
	if (rpc.length < 1)
		return;
	return rpc;
}

function getHScriptExtension(): string {
	return "." + vscode.workspace.getConfiguration().get("funkinVSCode.hscriptFileExtension") as string;
}

function updateLib(lib: string, terminal: vscode.Terminal) {
	let swagCommand = "haxelib install " + lib;
	(vscode.workspace.getConfiguration().get("funkinVSCode.haxelibs") as Array<string>).forEach(clib => {
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

function updateLibs(terminal: vscode.Terminal, ignore?: string) {
	let commands: Array<string> = [];
	(vscode.workspace.getConfiguration().get("funkinVSCode.haxelibs") as Array<string>).forEach(clib => {
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