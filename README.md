# VOLTEdit
VOLTEdit is a web-based SDVX chart editor, planned to support KSH and KSON chart formats.

You can use VOLTEdit on [here](https://0xF.kr/tools/voltedit).
However, note that this editor is in *very* early stage of active development now, so everything can break unexpectedly.
Moreover I'm developing it on live, so possibility of things breaking is pretty high.

VOLTEdit uses "Office S" icons of [icons8](https://icons8.com).

## Features
Currently, these features are available.

* Importing KSH and KSON files via drag-drop
	* Currently only notes, lasers, and beat lines are visible.
* Exporting to KSON format
* Multi-column view using WebGL
	* Scrolling view via scrollbar / mouse wheel
* Intuitive ribbon UI
	* Editor settings, saved via `localStorage`
* Support for English and Korean

Also see the "Planned Features" section.

## How to use
* Drag a KSH or KSON file to the editor to open it.
* Use scrollbar to scroll the view.
* Use number keys 1 to 6 to add notes.

## Building
Following npm packages need to be installed globally.
```
npm install -g uglify-es less less-plugin-clean-css
```

Then use `make` to build the JS and CSS files.

## Planned Features
These are planned features, as of 12 Jan 2020.

Also see the [milestones page](https://github.com/123jimin/voltedit/milestones).

### Goal
* KSH/KSON editor which can replace current kshoot editor
* Web-based editor supporting modern web browsers (mobile support, but _no IE_)
* Multi column, scrollable chart view using WebGL
* Live view of the chart as it's being edited (ambitious!)
* kson-centric, but can export to ksh with some degrade
* Multilingual (en and ko during development)

### Simple Chart Creator
These features will be implemented by this weekend.
* Writing simple KSH file

These features will be implemented by this month.
* Selecting
* Editing notes
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
* Reading camera effects of a KSH file
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
