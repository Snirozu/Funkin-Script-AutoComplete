import requests
import json
import os

with open(os.getcwd() + "\src\psych_data.json", 'r') as f:
  psych_data = json.load(f)

luaClassResponse = requests.get("https://raw.githubusercontent.com/ShadowMario/FNF-PsychEngine/main/source/FunkinLua.hx")
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
	
	while (i < len(luaClass)):
		if (stringValue == 0 and not inVariable):
			if string[i] == "\n" or string[i] == "\t":
				curWord = ""
			elif string[i] != " ":
				curWord += string[i]

			if (curWord == 'Lua_helper.add_callback(lua,'):
				inFunction = True

			if (curWord == "set("):
				curWord = ""
				inVariable = True

		if (inVariable):
			if (string[i] != '"' and string[i] != "'" and string[i] != "("):
				if (string[i] == ","):
					if (psych_data["variables"].get(curWord) == None):
						psych_data["variables"][curWord] = {}
						psych_data["variables"][curWord]["returns"] = "???"
						psych_data["variables"][curWord]["documentation"] = "Needs documentation"
						print("Found Missing Variable: " + curWord)
					inVariable = False
					curWord = ""
				else:
					curWord += string[i]

		if (stringValue < 2 and inFunction and (string[i] == '"' or string[i] == "'")):
			stringValue += 1
			if (stringValue == 2):
				curWord = ""

		if (stringValue == 1 and inFunction and (string[i] != "," and string[i] != " " and string[i] != '"' and string[i] != "'")):
			functionName += string[i]

		if (stringValue == 2 and not inArgs):
			if (psych_data["functions"].get(functionName) != None):
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
				if (psych_data["functions"].get(functionName) == None):
					psych_data["functions"][functionName] = {}
					psych_data["functions"][functionName]["returns"] = "???"
					psych_data["functions"][functionName]["args"] = args
					psych_data["functions"][functionName]["documentation"] = "Needs documentation"
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

with open('src/psych_data.json', 'w', encoding='utf-8') as f:
    json.dump(psych_data, f, ensure_ascii=False, indent=4)
