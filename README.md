# VOLTEdit
VOLTEdit is a web-based SDVX chart editor, planned to support KSH and KSON chart formats.

Used "Office S" icons of [icons8](https://icons8.com).

## Features
Currently, these features are available. Note that this editor is in *very* early stage of active development now.

* Importing KSH files via drag-drop
	* Currently only notes and beat lines are visible.
* Exporting to KSON format
* Scrolling view via mouse wheel
	* I know that this is quite slow. I'll add other methods for navigating.
* Intuitive ribbon UI
	* Editor settings, saved via `localStorage`
* Support for English and Korean

## Planned Features
These are planned features, as of 05 Jan 2020.

### Goal
* KSH/KSON editor which can replace current kshoot editor
* Web-based editor supporting modern web browsers (IE excluded)
* Single column, scrollable chart view like stepmania
* Live view of the chart as it's being edited (ambitious!)
* kson-centric, but can export to ksh with some degrade
* Multilingual (en and ko during development)

### Currently in Development
These features will be implemented by next weekend.
* Displaying lasers
* Scrollbar for faster navigating

### High Priority
These features will be implemented by this month.
* BPM and time signature display
* Reading most of KSH files, including zoom and stop effects
* Note addition

These features will likely be implemented by Feburary.
* Reading simple KSON files
* Audio Playback
* Note deletion, long note edit
* Displaying most of KSH contents

### Middle Priority
These features are planned to be implemented by April.
* Editing lasers with bezier curves
* Writing KSH file
* Editing chart metadata

These features are planned to be implemented by June.
* Simple audio effects (filters, gate)
* Editing simple camera effects
* Chart linter (detect illegals and semi-illegals)
* Resolution adjustment
* Be able to replace kshoot editor for non-effect charts

### Low Priority
These features are planned to be implemented in this year.
* Displaying all informations presentable in a KSON file, except layers
* JA and CN support, if others kindly provide translations
* Editing all camera effects
* Live chart viewer
* Editing event-triggered effects
* Auto-sync w/ beat analysis

### In Consideration
I hope to be able to implement these features in this year, but not sure whether it will be feasible.
* Playing all audio effects supported by KSON
* Editing/previewing KSON chart layers
* Add multi-column views, like kshoot editor
* Advanced chart linter (measures ballpark difficulty)
