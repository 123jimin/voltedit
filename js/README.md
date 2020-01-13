# voltedit/js
This is where the JS source codes resides.

## Structure
* `editor.js` contains the code for high-level operations of the editor.
* `js/util` contains misc codes useful for VOLTEdit.
	* `l10n.js` for translations (`/translations.js` contains data)
	* `aa-tree.js` for [AA trees](https://en.wikipedia.org/wiki/AA_tree)
	* `settings.js` for settings (stored in `localStorage`)
* `js/data` contains codes related to writing, reading, and manipulating charts.
	* `chart.js` contains codes related to manipulating charts and writing to `.kson`.
		* `VChartData` class represents a chart.
		* Its structure is based on KSON, but it uses AA trees instead of arrays to manage elements of charts.
		* However, inserting and deleting `time_sig` can't be represented by operations on AA trees well, so they are kept as arrays.
	* `kson.js` contains codes related to importing `.kson` charts.
	* `ksh.js` and `ksh-exporter.js` contains codes related to importing and exporting `.ksh` charts.
	* `graph.js` contains codes for managing graph segments (lasers, camera values, ...) of a chart.
* `js/view` contains codes related to drawing charts.
	* `view.js` contains `VView` for manipulating the renderer and providing inputs to the editor.
		* It translates `VChartData` into render ops.
		* It translates cursor movements into meaningful operations.
	* `view-components.js` contains various components of `VView`, which is not directly related to rendering the chart.
		* `VViewScrollBar` for the scrollbar
		* `VViewBaseLines` for the baselines (vertical lines)
			* Uses SVG, because it's the simplest.
		* `VViewRenderQueue` for managing the rendering queue
			* It's not very useful, I know.
			* It's an artifact from the past where rendering is done with SVG.
	* `render.js` contains `VViewRender` for displaying the chart through `THREE.js`.
		* I first tried SVG for rendering, but it has issues with multi-column view.
			* `<use/>` turned out to be horrible and severely broken for the task, and manually duplicating elements is tedious.
		* Separating `VView` and `VViewRender` can be seen as unnecessary, but I like what they are now.
	* `render-components.js` contains various components of the renderer.
		* `VViewColumn` for representing a single column view
			* Each column is a camera, just in different y-positions.
		* `VTickPropText` and `VTickProp` for displaying properties of a single tick (a single KSH line)
		* `VModelTemplate` and `VModelTemplateCollection` for managing object templates
* `js/manager` contains various sub-components of the editor.
	* `file-manager.js` managing reading and writing files
	* `key-manager.js` managing keybindings
	* `task-manager.js` managing edit operations
* `js/edit` contains codes related to editing.
	* `tasks.js` contains various edit operations.
		* Each operation inherits `VTask`, and must override certain functions.
			* `constructor(editor, ...)` with a call `super(editor)`
			* `_validate()` for validating the operation just before committing it
			* `_commit()` for actually doing the operation
			* `_makeInverse()` for generating the inverse operation just before committing
		* This enables *extremely* liberal execution of redo and undo, no limit on how many operations can be undo.
	* `context.js` manages edit contexts. (TBD)
* `js/ui` contains code related to UI, excluding chart display.
	* `toolbar.js` contains code for managing the toolbar.
	* `message.js` contains code for displaying various messages.
		* Example: "Save succeed", "Chart reading error", ...

## Building
Currently module system is not used, and everything is managed by `/Makefile`.
There are two files made with `make`.
* `js/voltedit.min.js`: contains the whole (non-library) source code.
* `js/voltedit.version.js`: contains the version information.
