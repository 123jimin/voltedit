class VEditContext {
	constructor(editor, contextId) {
		this.editor = editor;
		this.view = this.editor.view;
		this.contextId = contextId;

		this.dragStarted = false;
		this.startTick = 0;
		this.startLane = 0;
		this.startV = 0;

		this.selectedObjects = new Set();
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
	getObjectAt(event) {
		return null;
	}
	createObjectAt(event) {
	}
	/// tick: y-value, lane and v: x-value
	/// lane can be -1 or 4 (out of range)
	/// x-value: 0.0 for left laser pos, and 1.0 for right laser pos
	onMouseDown(event) {
		this._setDragStart(event);

		const obj = this.getObjectAt(event);
		if(!obj || !this.selectedObjects.has(obj)){
			if(!event.shiftKey) this.clearSelection();
			if(!obj && !event.shiftKey){
				this.view.setCursor(event.tick);
				if(this.addObjectEnabled() && this.editor.chartData){
					this.createObjectAt(event);
				}
				return;
			}
		}

		this.addToSelection(obj);
	}
	_setDragStart(event) {
		this.dragStarted = true;
		this.startTick = event.tick;
		this.startLane = event.lane;
		this.startLaser = event.v;
	}
	onMouseDrag(event) {
	}
	onMouseUp(event) {
		this.dragStarted = false;
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
	createObjectAt(event) {
		if(event.lane < 0 || event.lane >= 4) return;
		const addTask = new VNoteAddTask(this.editor, this.type, event.lane, event.tick, 0);
		if(this.editor.taskManager.do(`task-add-${this.type}`, addTask)) {
			this.addToSelection(this.getObjectAt(event));
		}
	}
	getObjectAt(event) {
		let lane = event.lane;
		if(lane < 0 || lane >= 4) return null;
		if(!this.editor.chartData) return null;

		if(this.type === 'fx') lane >>= 1;

		const noteData = this.editor.chartData.getNoteData(this.type, lane);
		if(!noteData) return null;

		const note = noteData.get(event.tick);
		if(!note) return null;

		return note.data;
	}
}

class VEditLaserContext extends VEditContext {
	constructor(editor, lane) {
		super(editor, `${['left','right'][lane]}-laser`);
		this.lane = lane;
	}
}
