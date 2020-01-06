# VOLTEdit
VOLTEdit is a web-based SDVX chart editor, planned to support KSH and KSON chart formats.

Used "Office S" icons of [icons8](https://icons8.com).

## Features
Currently, these features are available. Note that this editor is in *very* early stage of active development now.

* Importing KSH files via drag-drop
	* Currently only notes and beat lines are visible.
* Exporting to KSON format
* Scrolling view via scrollbar / mouse wheel
* Intuitive ribbon UI
	* Editor settings, saved via `localStorage`
* Support for English and Korean

## Planned Features
These are planned features, as of 06 Jan 2020.

Also see the [milestones page](https://github.com/123jimin/voltedit/milestones).

### Goal
* KSH/KSON editor which can replace current kshoot editor
* Web-based editor supporting modern web browsers (IE excluded)
* Single column, scrollable chart view like stepmania
* Live view of the chart as it's being edited (ambitious!)
* kson-centric, but can export to ksh with some degrade
* Multilingual (en and ko during development)

### Simple KSH Viewer
These features will be implemented by this weekend.
* Displaying lasers
* Displaying BPM and time signatures
* Moving the cursor

### Simple Chart Creator
These features will be implemented by this month.
* Editing notes and lasers
* Keyboard shortcuts
* Redo/undo system
* Reading camera effects of a KSH file
* Writing KSH file
* Editing chart metadata

### Middle Priority
These features will likely be implemented by Feburary.
* Reading simple KSON files
* Audio Playback

These features are planned to be implemented by April.
* Editing lasers with bezier curves
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
* Live chart viewer
* Editing event-triggered effects
* Auto-sync w/ beat analysis

### In Consideration
I hope to be able to implement these features in this year, but not sure whether it will be feasible.
* Playing all audio effects supported by KSON
* Editing/previewing KSON chart layers
* Add multi-column views, like kshoot editor
* Advanced chart linter (measures ballpark difficulty)
