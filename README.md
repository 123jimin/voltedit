# VOLTEdit
VOLTEdit is a web-based SDVX chart editor, planned to support KSH and KSON chart formats.

You can use VOLTEdit on [here](https://0xF.kr/tools/voltedit).
However, note that this editor is in *very* early stage of active development now, so everything can break unexpectedly.
Moreover I'm developing it on live, so possibility of things breaking is pretty high.

VOLTEdit uses "Office S" icons of [icons8](https://icons8.com).

## Features
Currently, these features are available.

* **Reading and writing KSH and KSON files**
	* Yes, basic KSH <-> KSON conversion is supported!
		* Only supports notes, lasers, beat lines, and BPM changes are preserved for now.
	* [Native file system](https://web.dev/native-file-system/) is supported (if enabled via `chrome://flags`)
		* Ctrl+S actually updates the original ksh/kson file!
		* Be careful that currently some informations such as camera zooms and FX effects are lost while done on KSH.
	* No internal restriction on number of lanes/lasers
		* To enable for VOLTEdit to edit other games' chart such as Pop'n Music, DDR, PIU, ...
		* Data structure and edit operations have no fundamental limitations on them.
		* Current renderer does not support configuration other than 4 BT lanes and 2 FX lanes currently, but multiple lasers are supported.
* **Multi-column view using WebGL**
	* Currently only notes, lasers, and beat lines are visible.
	* Scrolling view can be done via scrollbar / mouse wheel.
* **Editing chart**
	* Currently, inserting/moving/deleting short FX/BTs are supported.
	* Full redo/undo support for most edit operations.
	* Editor settings are saved via `localStorage`.
	* Ribbon UI available.
* **Available in English and Korean**

Also see the "Planned Features" section.

## How to use
* Drag a KSH or KSON file to the editor to open it.
* Use scrollbar to scroll the view.
* Use mod change buttons (BT, FX) and input toggle (In) to enable editing via clicking.
* Use number keys 1 to 6 to add notes.

## Building
Following npm packages need to be installed globally.
```
npm install -g uglify-es less less-plugin-clean-css
```

Then use `make` to build the JS and CSS files.

## Planned Features
These are planned features, as of 17 Jan 2020.

Also see the [milestones page](https://github.com/123jimin/voltedit/milestones).

### Goal
* KSH/KSON editor which can replace current kshoot editor
* Web-based editor supporting modern web browsers (mobile support, but _no IE_)
* Multi column, scrollable chart view using WebGL
* Live camera view of the chart as it's being edited (ambitious!)
* kson-centric, but can export to ksh with some degrade
* Multilingual (en and ko during development)

### Simple Chart Creator
These features will be implemented by this weekend.
* Creating and editing long notes
* Reading/writing camera effects for KSON and KSH (read only for now)

These features will be implemented by this month.
* Ctrl+C/V
* Adding lasers
* Editing chart metadata

### Middle Priority
These features will likely be implemented by Feburary.
* Editing lasers with bezier curves
* Audio Playback
* Reading FX/laser filter/laser volume effects of a KSH file

These features are planned to be implemented by April.
* Live chart viewer (!)
* Displaying most of KSH contents
* Editing simple camera effects

These features are planned to be implemented by June.
* Simple audio effects (filters, gate)
* Chart linter (detect illegals and semi-illegals)
* Resolution adjustment
* Be able to replace kshoot editor for non-effect charts

### Low Priority
These features are planned to be implemented in this year.
* Displaying all informations presentable in a KSON file, except layers
* JA and CN support, if others kindly provide translations
* Editing all camera effects
* Editing event-triggered effects
* Auto-sync w/ beat analysis

### In Consideration
I hope to be able to implement these features in this year, but not sure whether it will be feasible.
* Playing all audio effects supported by KSON
* Editing/previewing KSON chart layers
* Advanced chart linter (measures ballpark difficulty)
* Multiple game support, including Pop'n Music, DDR, PIU, WACCA, RB, ...
