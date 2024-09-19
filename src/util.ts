import { Color } from "vscode";

export function getLineContentAt(document: string, index: number) {
	if (index <= -1) {
		return null;
	}
	let word = "";
	for (let i = index; i < document.length; i++) {
		const char = document.charAt(i);
		if (char == "\n") {
			break;
		}
		word += char;
	}
	return word;
}

// most of the code is from stack overflow... yes i used this fucking website lol
export function rgbaToHex(r: number, g: number, b: number, a: number) {
	r*=255; g*=255; b*=255; a*=255;
    return "#" + (256 + r).toString(16).slice(1) + ((1 << 24) + (g << 16) | (b << 8) | a).toString(16).slice(1);
}

export function hexToVSColor(hex: string) {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;

	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b))
		return null;

	if (hex.length > 7)
		return new Color(r, g, b, parseInt(hex.slice(7, 9), 16) / 255);

	return new Color(r, g, b, 1);
}

export function characterOffsetToByteOffset(string:string, offset: number):number {
	if (offset == 0)
		return 0;
	else if (offset == string.length)
		return Buffer.byteLength(string, "utf-8");
	else
		return Buffer.byteLength(string.substring(0, offset), "utf-8");
}