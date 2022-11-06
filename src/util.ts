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