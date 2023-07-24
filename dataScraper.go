package main

// using go because python is shit (only because it's syntax) and i couldn't find a better alternative to python than go
// also go is pretty nice language

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
)

type Data struct {
    Functions map[string]Func `json:"functions"`
	Variables map[string]Var `json:"variables"`
	Events map[string]Event `json:"events"`
}

type Func struct {
    Returns string `json:"returns"`
    Args string `json:"args"`
    Documentation string `json:"documentation"`
	Deprecated string `json:"deprecated,omitempty"` // omitempty will not render empty fields
}

type Var struct {
    Returns string `json:"returns"`
    Documentation string `json:"documentation"`
	Deprecated string `json:"deprecated,omitempty"`
}

type Event struct {
	Returns string `json:"returns"`
	Args string `json:"args"`
	Documentation string `json:"documentation"`
	Deprecated string `json:"deprecated,omitempty"`
}

func main() {
	jsonData := Data{
		Functions: map[string]Func{},
		Variables: map[string]Var{},
		Events: map[string]Event{},
	}

	engineJsonData := Data{
		Functions: map[string]Func{},
		Variables: map[string]Var{},
		Events: map[string]Event{},
	}

	engineData, err := os.ReadFile("data/psych_0.7.json")
	if err == nil {
		// pointer jumpscare
		json.Unmarshal(engineData, &engineJsonData)
	}
	
	// i generated this dataInput.txt file using CTRL+SHIFT+F in the psych engines source code and it that window i searched for "Lua_helper.add_callback(lua,"
	// there after searching for that query, should be a "Open in editor" button which creates a copyable file, that file is basically dataInput.txt
	data, err := os.ReadFile("dataInput.txt")
	if err != nil {
		log.Fatal(err)
	}

	word := ""
	wordIndex := 0
	name := ""
	args := ""
	insideCallback := false
	insideFunctionArgs := false
	for _, cha := range data {
		char := string(cha)
		if (!insideCallback) {
			word = word + char
		}
		if (insideCallback && rune(cha) > 32) { // that was supposed to be used later but fuck it lol
			word = word + char
		}

		if (!insideCallback && rune(cha) <= 32) { //clear the word if loop encounters a blank character
			word = ""
			continue
		}

		if (insideCallback) {
			if (char == "," && wordIndex == 0) { //if has a comma then jump into args from name
				wordIndex = 1
				word = ""
				continue
			}

			if (wordIndex == 0 && rune(cha) > 32 && cha != '\'' && cha != '"') { //wait for the name
				name = name + char
				continue
			}

			if (wordIndex == 1 && !insideFunctionArgs && char == "(") { // begin arguments
				insideFunctionArgs = true
				continue
			}

			if (wordIndex == 1 && insideFunctionArgs && char != ")") { // append to args
				args = args + char
				continue
			}

			if (insideFunctionArgs && char == ")") { //stop on ")" in the "function()" and append it to the data
				swagFunc := Func{
					Returns: "void?",
					Args: args,
					Documentation: "No documentation yet.",
				}
				if fun, exists := engineJsonData.Functions[name]; exists {
					if (fun.Returns != "") {
						swagFunc.Returns = fun.Returns
					}
					if (fun.Documentation != "") {
						swagFunc.Documentation = fun.Documentation
					}
				}
				jsonData.Functions[name] = swagFunc

				word = ""
				insideCallback = false
				wordIndex = 0
				name = ""
				args = ""
				insideFunctionArgs = false
				continue
			}
		}

		if (word == "Lua_helper.add_callback(lua,") {
			word = ""
			insideCallback = true
			wordIndex = 0
			name = ""
			args = ""
			insideFunctionArgs = false
			continue
		}
	}

	jsonData.Events = engineJsonData.Events
	jsonData.Variables = engineJsonData.Variables

	for key, fun := range engineJsonData.Functions { 
		if fun2, exists := jsonData.Functions[key]; !exists && fun2.Deprecated == "" {
			fun.Deprecated = "Removed from the API."
			jsonData.Functions[key] = fun
		}
	}

	file, _ := json.MarshalIndent(jsonData, "", "\t")
	err = os.WriteFile("dataOutput.json", file, 0644)
	if err != nil {
		log.Fatal("Couldn't save the output data file!")
	} else {
		fmt.Println("Saved the output data to 'dataOutput.json' file!")
	}
}
