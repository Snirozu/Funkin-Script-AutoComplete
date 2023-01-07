# Funkin Script AutoComplete
Simple AutoCompleter for [Psych Engine](https://github.com/ShadowMario/FNF-PsychEngine) and [PEngine](https://github.com/Snirozu/Funkin-PEngine) Lua scripts.<br>

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

Report bugs and contribute to this extension on [Github](https://github.com/Snirozu/Funkin-Script-AutoComplete)

## Contributing
Any pull requests are appreciated, feel free to Pull Request any missing engines, functions or variables! <br>
If you want to add another engine to this extension make a json file in src/ called something like "piss-engine_data.json", this data file should be based of any `*_data.json` file <br>
### Adding a engine
#### Creating a data file from a engine's lua class URL 
1. Open `art/updateEngineData.py`
2. Add `case "yourEngineName":` at the end of `match Data.engine_name:` in `selectEngine()`
3. Follow the pattern of previous cases
4. Run `python art/updateEngineData.py` in current repo's directory and enter `yourEngineName` there
5. This will create a data file in `src/yourEngineName_data.json`

If the data file is empty or lacks functions / variables or the function names are corrupted you can: <br>
**A)** Add support for engine in updateEngineData.py <br>
**B)** Add everything manually
### Update existing engine data
If `art/updateEngineData.py` has support for some engine then:
1. Run `python art/updateEngineData.py` in current repo's directory and enter the name of engine there

You should manually add/change `documentation` value (if `documentation` is "Needs documentation" or doesn't exist) and a `returns` value (if `returns` is "???" or doesn't exist) <br>
If a function is deprecated add `"deprecated": "deprecated message here"` to the function

## Extension Installation
[DOWNLOAD FROM MARKETPLACE HERE](https://marketplace.visualstudio.com/items?itemName=Paidyy.funkin-script-autocomplete)<br>
or
1. Download the .vsix file from the latest release
2. Open **Visual Studio Code** and select **Extensions** from the left bar
3. At the top of Extensions menu click on three dots and select "**Install From VSIX...**"
4. In the Install from VSIX window select downloaded .vsix file
5. Restart Visual Studio Code
6. Optionally you can change the targetted engine in **File/Preferences/Settings/Extensions/Funkin Script AutoComplete/Lua Engine**

## Testing
1. Clone this repo
2. Run ```npm install``` in terminal
3. Start Debugging
