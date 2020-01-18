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

		this.selectedObjects = new Set();
	}
	/* Encouraged to override */
	_showHoverDrawing(event) { return false; }
	_showDragDrawing(event) {}
	canMakeObjectAt(event) { return false; }
	getObjectAt(event) { return null; }
	createObjectAt(startEvent, endEvent) {}
	selectRange(from, to) {}
	areSamePos(e1, e2) { return e1.tick === e2.tick && e1.lane === e2.lane; }

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
				if(event.tick >= 0 && this.addObjectEnabled()
					&& this.editor.chartData && this.canMakeObjectAt(event)){
						this.dragIntent = VEDIT_DRAG_INTENT.CREATE;
				}
				return;
			}
		}else{
			// object exists and already selected
			if(event.shiftKey){
				this.removeFromSelection(obj);
				this.view.hideDrawing();
				return;
			}
		}
		this.addToSelection(obj);
		this.view.hideDrawing();
	}
	_setDragStart(event) {
		this.dragIntent = VEDIT_DRAG_INTENT.NONE;
		this.startEvent = event;
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
			case VEDIT_DRAG_INTENT.CREATE:
				this._showDragDrawing(event);
				break;
		}
	}
	onMouseHover(event) {
		if(this.editor.insertMode){
			if(!this._showHoverDrawing(event)){
				this.view.hideDrawing();
			}
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
			case VEDIT_DRAG_INTENT.CREATE:
				this.createObjectAt(this.startEvent, event);
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
		// Just clicking at the same position should do nothing
		if(this.areSamePos(startEvent, endEvent)) return;

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
	_getLane(type, lane) {
		if(!this.editor.chartData || lane < 0) return -1;
		if(type === 'fx') lane >>= 1;
		if(lane >= this.editor.chartData.getLaneCount(type)) return -1;
		return lane;
	}
	_getNoteData(type, eventLane) {
		const lane = this._getLane(type, eventLane);
		if(lane < 0) return null;
		else return this.editor.chartData.getNoteData(type, lane);
	}
	_showHoverDrawing(event) {
		if(event.tick < 0) return false;
		const lane = this._getLane(this.type, event.lane);
		if(lane < 0) return false;

		this.view.showNoteDrawing(this.type, lane, event.tick, 0);
		return true;
	}
	_showDragDrawing(event) {
		if(event.tick < 0 || this.startEvent.tick < 0) return false;

		const lane = this._getLane(this.type, this.startEvent.lane);
		if(lane < 0) return false;

		this.view.showNoteDrawing(this.type, lane, this.startEvent.tick, event.tick-this.startEvent.tick);
		return true;
	}
	getObjectAt(event) {
		if(!this.editor.chartData) return null;

		let noteData = this._getNoteData(this.type, event.lane)
		let note = noteData && noteData.get(event.tick);
		if(!note && !this.editor.insertMode) {
			// For selecting notes, let's enable users to select FX in BT mode and vice versa.
			noteData = this._getNoteData(this.type === 'fx' ? 'bt' : 'fx', event.lane);
			note = noteData && noteData.get(event.tick);
		}

		return note && note.data;
	}
	canMakeObjectAt(event) {
		return event.tick >= 0 && this._getLane(this.type, event.lane) >= 0;
	}
	createObjectAt(startEvent, endEvent) {
		const lane = this._getLane(this.type, startEvent.lane);
		if(lane < 0) return null;

		let [startTick, len] = [startEvent.tick, endEvent.tick-startEvent.tick];
		if(len < 0){
			startTick += len;
			len = -len;
		}

		const addTask = new VNoteAddTask(this.editor, this.type, lane, startTick, len);
		if(this.editor.taskManager.do(`task-add-${this.type}`, addTask)) {
			const created = this.getObjectAt(startEvent);
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

class VEditGraphSectionContext extends VEditContext {}

class VEditLaserContext extends VEditGraphSectionContext {
	constructor(editor, lane) {
		super(editor, `laser-${['left','right'][lane]}`);
		this.lane = lane;
	}
}
