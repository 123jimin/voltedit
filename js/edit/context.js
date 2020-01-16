const VEDIT_DRAG_INTENT = Object.freeze({
	'NONE': 0, 'SELECT': 1, 'MOVE': 2, 'CREATE': 3,
});

class VEditContext {
	constructor(editor, contextId) {
		this.editor = editor;
		this.view = this.editor.view;
		this.contextId = contextId;

		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
		this.startEvent = null;
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
		this.view.setCursor();

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
				if(event.tick >= 0 && this.addObjectEnabled() && this.editor.chartData){
					this.startCreated = this.createObjectAt(event);
					this.dragIntent = VEDIT_DRAG_INTENT.CREATE;
				}
				return;
			}
		}else{
			// object exists and already selected
			if(event.shiftKey){
				this.removeFromSelection(obj);
				return;
			}
		}
		this.addToSelection(obj);
	}
	_setDragStart(event) {
		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
		this.startEvent = event;
		this.startCreated = null;
	}
	onMouseDrag(event) {
		switch(this.dragIntent) {
			case VEDIT_DRAG_INTENT.SELECT:
				this.view.setCursor(this.startEvent.tick, event.tick);
				break;
			case VEDIT_DRAG_INTENT.MOVE:
				this.selectedObjects.forEach((obj) => {
					obj.fakeMoveTo(this.view, this.startEvent, event);
				});
				break;
		}
	}
	onMouseUp(event) {
		switch(this.dragIntent) {
			case VEDIT_DRAG_INTENT.SELECT:
				this.selectRange(this.view.cursorStartLoc, this.view.cursorEndLoc);
				break;
			case VEDIT_DRAG_INTENT.MOVE:
				this.moveSelection(this.startEvent, event);
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
	removeFromSelection(obj) {
		obj.sel(this.view, false);
		obj.resetFakeMoveTo(this.view);
		this.selectedObjects.delete(obj);
	}
	clearSelection() {
		this.selectedObjects.forEach((obj) => this.removeFromSelection(obj));
		this.selectedObjects.clear();
	}
	deleteSelection() {
		if(this.selectedObjects.size === 0) return;

		const delTasks = [];
		this.selectedObjects.forEach((obj) => delTasks.push(obj.delTask(this.editor)));

		this.editor.taskManager.do('task-delete-selection', VTask.join(delTasks));

		this.selectedObjects.clear();
	}
	moveSelection(startEvent, endEvent) {
		if(this.selectedObjects.size === 0) return;

		const delTasks = [];
		this.selectedObjects.forEach((obj) => delTasks.push(obj.delTask(this.editor)));

		const moveTasks = [];
		this.selectedObjects.forEach((obj) => moveTasks.push(obj.moveTask(this.editor, startEvent, endEvent)));

		this.editor.taskManager.do('task-move-selection', VTask.join([VTask.join(delTasks), VTask.join(moveTasks)]));

		// TODO: retain selection
		this.selectedObjects.clear();
	}
}

class VEditChartContext extends VEditContext {
	constructor(editor) {
		super(editor, 'chart');
	}
	selectRange(from, to) {
		if(!this.editor.chartData) return;

		const chartData = this.editor.chartData;
		if(!chartData) return;

		['bt', 'fx'].forEach((type) => chartData.forAllNotesInRange(type, from, to,
			(node) => this.addToSelection(node.data)));
	}
}

class VEditNoteContext extends VEditContext {
	constructor(editor, type) {
		super(editor, type);
		this.type = type;
		this.draggingNote = false;
	}
	_getNoteData(type, eventLane) {
		let lane = eventLane;
		if(!this.editor.chartData || lane < 0) return null;
		if(type === 'fx') lane >>= 1;
		if(lane >= this.editor.chartData.getLaneCount(type)) return;

		return this.editor.chartData.getNoteData(type, lane);
	}
	getObjectAt(event) {
		if(!this.editor.chartData) return null;

		let noteData = this._getNoteData(this.type, event.lane)
		let note = noteData && noteData.get(event.tick);
		if(!note) {
			// For selecting notes, let's enable users to select FX in BT mode and vice versa.
			noteData = this._getNoteData(this.type === 'fx' ? 'bt' : 'fx', event.lane);
			note = noteData && noteData.get(event.tick);
		}

		return note && note.data;
	}
	createObjectAt(event) {
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
		const chartData = this.editor.chartData;
		if(!chartData) return;

		['bt', 'fx'].forEach((type) => chartData.forAllNotesInRange(type, from, to,
			(node) => this.addToSelection(node.data)));
	}
}

class VEditLaserContext extends VEditContext {
	constructor(editor, lane) {
		super(editor, `${['left','right'][lane]}-laser`);
		this.lane = lane;
	}
}
