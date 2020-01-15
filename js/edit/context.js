const VEDIT_DRAG_INTENT = Object.freeze({
	'NONE': 0, 'SELECT': 1, 'MOVE': 2, 'CREATE': 3,
});

class VEditContext {
	constructor(editor, contextId) {
		this.editor = editor;
		this.view = this.editor.view;
		this.contextId = contextId;

		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
		this.startTick = 0;
		this.startLane = 0;
		this.startV = 0;
		this.startCreated = null;

		this.selectedObjects = new Set();
	}
	/* Encouraged to override */
	getObjectAt(event) { return null; }
	createObjectAt(event) {}
	selectRange(from, to) {}

	/* Provided */
	/// tick: y-value, lane and v: x-value
	/// lane can be -1 or 4 (out of range)
	/// x-value: 0.0 for left laser pos, and 1.0 for right laser pos
	onMouseDown(event) {
		this._setDragStart(event);

		const obj = this.getObjectAt(event);
		if(obj) {
			this.dragIntent = event.shiftKey ? VEDIT_DRAG_INTENT.SELECT : VEDIT_DRAG_INTENT.MOVE;
		} else {
			// ... unless a new object is created later in this function.
			this.dragIntent = VEDIT_DRAG_INTENT.SELECT;
		}

		if(!obj || !this.selectedObjects.has(obj)){
			if(!event.shiftKey) this.clearSelection();
			if(!obj && !event.shiftKey){
				this.view.setCursor(event.tick);
				if(this.addObjectEnabled() && this.editor.chartData){
					this.startCreated = this.createObjectAt(event);
					this.dragIntent = VEDIT_DRAG_INTENT.CREATE;
				}
				return;
			}
		}

		this.addToSelection(obj);
	}
	_setDragStart(event) {
		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
		this.startTick = event.tick;
		this.startLane = event.lane;
		this.startLaser = event.v;
		this.startCreated = null;
	}
	onMouseDrag(event) {
		switch(this.dragIntent) {
			case VEDIT_DRAG_INTENT.SELECT:
				this.view.setCursor(this.startTick, event.tick);
				break;
		}
	}
	onMouseUp(event) {
		switch(this.dragIntent) {
			case VEDIT_DRAG_INTENT.SELECT:
				this.view.setCursor(this.startTick, event.tick);
				this.selectRange(this.view.cursorStartLoc, this.view.cursorEndLoc);
				break;
		}
		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
	}
	addObjectEnabled() {
		return this.editor.insertMode;
	}
	addToSelection(obj) {
		if(!obj) return;

		this.selectedObjects.add(obj);
		obj.sel(this.view, true);
	}
	clearSelection() {
		this.selectedObjects.forEach((obj) => obj.sel(this.view, false));
		this.selectedObjects.clear();
	}
	deleteSelection() {
		if(this.selectedObjects.size === 0) return;

		let delTasks = [];
		this.selectedObjects.forEach((obj) => delTasks.push(obj.delTask(this.editor)));

		if(delTasks.length === 1) this.editor.taskManager.do('task-delete-selection', delTasks[0]);
		else this.editor.taskManager.do('task-delete-selection', new VTaskCollection(this.editor, delTasks));
	}
}

class VEditChartContext extends VEditContext {
	constructor(editor) {
		super(editor, 'chart');
	}
}

class VEditNoteContext extends VEditContext {
	constructor(editor, type) {
		super(editor, type);
		this.type = type;
		this.draggingNote = false;
	}
	getObjectAt(event) {
		if(!this.editor.chartData) return null;

		let lane = event.lane;
		if(lane < 0) return null;

		if(this.type === 'fx') lane >>= 1;
		if(lane >= this.editor.chartData.getLaneCount(this.type)) return;

		const noteData = this.editor.chartData.getNoteData(this.type, lane);
		if(!noteData) return null;

		const note = noteData.get(event.tick);
		if(!note) return null;

		return note.data;
	}
	createObjectAt(event) {
		if(!this.editor.chartData) return null;

		let lane = event.lane;
		if(lane < 0) return null;

		if(this.type === 'fx') lane >>= 1;
		if(lane >= this.editor.chartData.getLaneCount(this.type)) return;

		const addTask = new VNoteAddTask(this.editor, this.type, lane, event.tick, 0);
		if(this.editor.taskManager.do(`task-add-${this.type}`, addTask)) {
			const created = this.getObjectAt(event);
			if(created) this.addToSelection(created);

			return created;
		}

		return null;
	}
	selectRange(from, to) {
		if(!this.editor.chartData) return;

		// All notes are range-selectable while in any EditNoteContext.
		['bt', 'fx'].forEach((type) => {
			const lanes = this.editor.chartData.getLaneCount(type);
			for(let i=0; i<lanes; ++i) {
				const noteData = this.editor.chartData.getNoteData(type, i);
				if(!noteData) continue;

				// `to` is intentionally omitted
				noteData.getAll(from, to-from).forEach((node) => {
					this.addToSelection(node.data);
				});
			}
		});
	}
}

class VEditLaserContext extends VEditContext {
	constructor(editor, lane) {
		super(editor, `${['left','right'][lane]}-laser`);
		this.lane = lane;
	}
}
