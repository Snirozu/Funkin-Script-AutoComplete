# Funkin Script AutoComplete
Simple AutoCompleter for [Psych Engine](https://github.com/ShadowMario/FNF-PsychEngine) and [PEngine](https://github.com/Paidyy/Funkin-PEngine) Lua scripts.<br>

# Features
- Function/Event/Variable auto completing
- Warnings for deprecated functions
- Hovers with documentation

# Quick Documentation
## Code Comments
- Enable this extension in a file: `---@funkinScript` (only if `funkinscriptautocomplete.enableOnlyOnCertainScripts` setting is on)
- Set FNF engine for this file: `---@funkinEngine={psych|pengine|etc.}`
- Disable deprecated warnings for specific function on this file: `---@diagnostic disable: {funcs}`
- Disable deprecated warnings for specific function on next line: `---@diagnostic disable-next-line: {funcs}`

Report bugs and contribute to this extension on [Github](https://github.com/Paidyy/Funkin-Script-AutoComplete)