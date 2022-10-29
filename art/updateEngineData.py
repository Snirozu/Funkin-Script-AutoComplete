import requests
import json
import os

class DataFuckYouPythonYouPieceOfFuckingShit:
	engine_data = None
	engine_url = ""
	engine_name = ""

	engine_setVariable = ""

Data = DataFuckYouPythonYouPieceOfFuckingShit

def selectEngine():
	print("Input engine name here...")
	Data.engine_name = input()

	# here add a engine
	match Data.engine_name:
		case "psych":
			Data.engine_url = "https://raw.githubusercontent.com/ShadowMario/FNF-PsychEngine/main/source/FunkinLua.hx"
			Data.engine_setVariable = "set"
		case "pengine":
			Data.engine_url = "https://raw.githubusercontent.com/Paidyy/Funkin-PEngine/main/source/LuaShit.hx"
			Data.engine_setVariable = "setVariable"

	if not Data.engine_url.startswith("http"):
		print("Unknown Engine.")
		selectEngine()
		return

	if not os.path.exists(os.getcwd() + f"\src\{Data.engine_name}_data.json"):
		print("Creating a data file in: " + os.getcwd() + f"\src\{Data.engine_name}_data.json")
		with open(os.getcwd() + f"\src\{Data.engine_name}_data.json", "w") as f:
			empty_config = {
				"functions": {},
				"variables": {},
				"events": {}
			}
			json.dump(empty_config, f)

	with open(os.getcwd() + f"\src\{Data.engine_name}_data.json", 'r') as f:
		Data.engine_data = json.load(f)

selectEngine()

luaClassResponse = requests.get(Data.engine_url)
luaClass = luaClassResponse.text

def findMissing(string:str):
	i = 0

	curWord = ""
	inFunction = False
	functionName = ""
	stringValue = 0
	args = ""
	inArgs = False

	inVariable = False
	inLineComment = False
	inMultiLineComment = False
	isInString = False
	_inStringChar = None
	
	while (i < len(luaClass)):
		if (stringValue == 0 and not inVariable):
			if string[i] == "\n" or string[i] == "\t":
				curWord = ""
			elif string[i] != " ":
				curWord += string[i]

			if (curWord == 'Lua_helper.add_callback(lua,'):
				inFunction = True

			if (curWord == Data.engine_setVariable + "("):
				curWord = ""
				inVariable = True

		if not isInString:
			if curWord == "//":
				inLineComment = True

			if curWord == "/*":
				inMultiLineComment = True

			if curWord == "*/":
				inMultiLineComment = False

			if string[i] == "\n":
				inLineComment = False

		if inLineComment or inMultiLineComment:
			i+=1
			continue
		else:
			if isInString is False:
				if string[i] == "'" or string[i] == '"':
					isInString = True
					_inStringChar = string[i]
			else:
				if string[i] == _inStringChar:
					isInString = False

		if (inVariable):
			if (string[i] != '"' and string[i] != "'" and string[i] != "("):
				if (string[i] == ","):
					if (Data.engine_data["variables"].get(curWord) == None):
						Data.engine_data["variables"][curWord] = {}
						Data.engine_data["variables"][curWord]["returns"] = "???"
						Data.engine_data["variables"][curWord]["documentation"] = "Needs documentation"
						print("Found Missing Variable: " + curWord)
					inVariable = False
					curWord = ""
				else:
					if isInString:
						curWord += string[i]

		if (stringValue < 2 and inFunction and (string[i] == '"' or string[i] == "'")):
			stringValue += 1
			if (stringValue == 2):
				curWord = ""

		if (stringValue == 1 and inFunction and (string[i] != "," and string[i] != " " and string[i] != '"' and string[i] != "'")):
			functionName += string[i]

		if (stringValue == 2 and not inArgs):
			if (Data.engine_data["functions"].get(functionName) != None):
				curWord = ""
				inFunction = False
				functionName = ""
				stringValue = 0
				args = ""
				inArgs = False
			else:
				if (string[i] != '"' and string[i] != "'" and string[i] != "," and string[i] != " "):
					curWord += string[i]

				if (curWord == "function("):
					inArgs = True
					i += 1

		if (inArgs):
			if (string[i] == ")"):
				if (Data.engine_data["functions"].get(functionName) == None):
					Data.engine_data["functions"][functionName] = {}
					Data.engine_data["functions"][functionName]["returns"] = "???"
					Data.engine_data["functions"][functionName]["args"] = args
					Data.engine_data["functions"][functionName]["documentation"] = "Needs documentation"
					print("Found Missing Function: " + functionName + "(" + args + ")")
				curWord = ""
				inFunction = False
				functionName = ""
				stringValue = 0
				args = ""
				inArgs = False
			else:
				args += string[i]

		# can't wait for python to add i++ like apple added battery percentage after fucking 15 years
		i += 1

findMissing(luaClass)

with open(f'src/{Data.engine_name}_data.json', 'w', encoding='utf-8') as f:
    json.dump(Data.engine_data, f, ensure_ascii=False, indent=4)
