# VOLTEdit
VOLTEdit is a web-based SDVX chart editor, planned to support KSH and KSON chart formats.

**NOTE: this project is deprecated in favor of another editor project which is yet to be released**

You can use VOLTEdit on [here](https://0xF.kr/tools/voltedit).
However, note that this editor is in *very* early stage of active development now, so everything can break unexpectedly.
Moreover I'm developing it on live, so possibility of things breaking is pretty high.

VOLTEdit uses "Office S" icons of [icons8](https://icons8.com).

## Features
Currently, these features are available.

* **Reading and writing KSH and KSON files**
	* Yes, basic KSH <-> KSON conversion is supported!
		* Notes and lasers
		* Beat lines and BPM changes
		* Stops and KSH `zoom_bottom`, `zoom_side`, `zoom_top`
	* [Native file system](https://web.dev/native-file-system/) is supported (if enabled via `chrome://flags`)
		* Ctrl+S actually updates the original ksh/kson file!
		* Be careful that currently some informations such as slam rotations and FX effects are lost while done on KSH.
	* No internal restriction on number of lanes/lasers
		* To enable for VOLTEdit to edit other games' chart such as Pop'n Music, DDR, PIU, ...
		* Data structure and edit operations have no fundamental limitations on them.
		* Current renderer does not support configuration other than 4 BT lanes and 2 FX lanes currently, but multiple lasers are supported.
* **Multi-column view using WebGL**
	* Currently only notes, lasers, and beat lines are visible.
	* Scrolling view can be done via scrollbar / mouse wheel.
* **Editing chart**
	* Ribbon UI is used for toolbar.
	* Inserting/moving/deleting short FX/BTs are supported.
	* Inserting/deleting laser points are supported.
	* Editing important chart metadata is supported.
	* Full redo/undo support for most edit operations.
	* Editor settings are saved via `localStorage`.
* **Available in English and Korean**

Also see the "Planned Features" section.

## How to use
* Drag a KSH or KSON file to the editor to open it.
* Use scrollbar to scroll the view.
* Use mod change buttons (BT, FX) and input toggle (In) to enable editing via clicking.
* Use number keys 1 to 6 to add notes.

### Editing lasers
This is the WIP sepcification for laser editing.

#### Adding
* When the area between the sole selected point and its next point is dragged:
	* A slam, connected to the selected point will be added.
* When the tick corresponding to the point right after the sole selected point is clicked:
	* If the beginning of the next segment is clicked, then two points are connected.
	* If the next segment does not start with a slam, and the existing start point is not clicked, then a slam is added.
	* If the end slam point of the beginning of the next segment is clicked, then **...?**
* Other than previously stated cases, following operations will be done:
	* If the tick being clicked is occupied by a point, then its vf will be changed.
	* Else, then a new point will be created.
#### Moving
#### Removing

## Building
Following npm packages need to be installed globally.
```
npm install -g uglify-es less less-plugin-clean-css
```

Then use `make` to build the JS and CSS files.

## Planned Features (DEPRECATED)
These are planned features as of 29 Jan 2020.
Some of plans may be changed later.

Also see the [milestones page](https://github.com/123jimin/voltedit/milestones).

### Goal
* KSH/KSON editor which can replace current kshoot editor
* Web-based editor supporting modern web browsers (mobile support, but _no IE_)
* Multi column, scrollable chart view using WebGL
* Live camera view of the chart as it's being edited (ambitious!)
* kson-centric, but can export to ksh with some degrade
* Multilingual (en and ko during development)

### February: KSH Compatibility
* Reading/Writing all KSH-compatible data, but not editing yet
	* FX/laser filter effects
	* Laser volume effects
	* Laser slam sound effects
* Enable adding laser points in a segment, by clicking.
* Editing lasers, perhaps with curves
* Reading/Writing slam rotation and tilt effects
	* Note: the current KSON spec is not concrete enough for implementing these.
	* Implementing these would be delayed until a concrete spec is made.

### March: UX Improvement 1, Simple Playback
* Ctrl+C/V
* Improving note and laser editing
* Audio playback
* Live chart viewer (literally just showing charts at a different angle)

### April: More KSH Editing
* Displaying most of KSH contents
* Editing simple camera effects
* Improved live chart viewer (applying camera effects)

### May: KSH Editor Replacement
* Simple audio effects (filters, gate)
* Be able to replace kshoot editor for non-effect charts

### June: More Powerful KSON-to-KSH Converter
* Resolution adjustment
* Support for exporting curve lasers and camera effects to KSH
* Chart linter (detect illegals and semi-illegals)

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

## Problems in KSON Spec
These are problems in [the current KSON spec](https://gist.github.com/m4saka/a89594a17dc9422d75e01998bcfd2722), discovered during developing this editor.
Refer to the spec and [the discussion thread](https://github.com/m4saka/kshootmania-v2/issues/1) for the up-to-date status of these issues.

### Recently Addressed Problems
Resolutions to these issues are available in the discussion thread.
* `CamInfo.tilt_assign`: It is unclear how NORMAL/BIGGER/BIGGEST tilts can be translated.
	* Using `rotation_z@tilt_assign` is suggested.
	* NORMAL/BIGGER/BIGGEST corresponds to +14/+21/+28.

### Major Problems
These are problems which prevent implementing the related functionalities.
* It is unclear how `CameraInfo.tilt` and `CamGraphs.rotation_z` interacts.
* KSH slam rotations can't be translated to KSON easily.
	* It seems that `CamPatternInfo.note_event` should be used.
	* However, it is unclear what to do when there are two identical slams at the same time.
	* The only feasible answer is to randomly pick one laser, but it's unsatisfactory.

### Minor Problems
These are small issues, which does not prevent implementating the related functionalities, but still needs to be addressed.
* -1.0 - +1.0 range of `TiltInfo.manual` seems to translate to -100 - +100 of that of KSH, but it's not explicitly specified.
* `GraphPoint.a` and `GraphPoint.b` are ambiguous.
	* Currently, using 2nd order bezier curve is almost certain, but it's not explicitly specified.
	* It is ambiguous that whether the curve after or before the point will be controlled with the control point.
		* Currently "after" is the preferred answer for me, due to how `js/view/render-laser.js` is structured.
