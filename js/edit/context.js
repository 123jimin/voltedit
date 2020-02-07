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
		this.prevClick = null;

		this.selectedObjects = new Set();
		this.prevSelected = null;
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
	updatePrevSelected() {
		if(this.selectedObjects.size === 1){
			this.selectedObjects.forEach((obj) => this.prevSelected = obj);
		}else{
			this.prevSelected = null;
		}
	}
	/// tick: y-value, lane and v: x-value
	/// lane can be -1 or 4 (out of range)
	/// x-value: 0.0 for left laser pos, and 1.0 for right laser pos
	onMouseDown(event) {
		this._setDragStart(event);
		this.view.setCursor();

		this.updatePrevSelected();

		const obj = this.getObjectAt(event);
		if(obj) {
			this.dragIntent = event.ctrlKey || event.shiftKey ? VEDIT_DRAG_INTENT.SELECT : VEDIT_DRAG_INTENT.MOVE;
		} else {
			// ... unless a new object is created later in this function.
			this.dragIntent = VEDIT_DRAG_INTENT.SELECT;
		}

		if(!(obj && this.selectedObjects.has(obj))){
			if(!(event.ctrlKey || event.shiftKey)){
				this.clearSelection();
				if(!obj){
					this.view.setCursor(event.tick);
					if(event.tick >= 0 && event.which === 1 && this.addObjectEnabled()
						&& this.editor.chartData && this.canMakeObjectAt(event)){
							this.dragIntent = VEDIT_DRAG_INTENT.CREATE;
					}
					return;
				}
			}
		}else{
			// object exists and already selected
			if(event.ctrlKey){
				this.removeFromSelection(obj);
				this.view.hideDrawing();
				return;
			}
			if(obj === this.prevSelected){
				this.dragIntent = VEDIT_DRAG_INTENT.CREATE;
			}
		}
		this.addToSelection(obj);
		this.view.hideDrawing();

		if(event.shiftKey && this.prevClick && this.hasSelection()){
			let [from, to] = [this.prevClick.tick, event.tick];
			if(from > to) [from, to] = [to, from];
			this.selectRange(from, to);
		}

		this.prevClick = event;
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
		this.updatePrevSelected();
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
	hasSelection() {
		return this.selectedObjects.size > 0;
	}
	clearSelection() {
		this.selectedObjects.forEach((obj) => this.removeFromSelection(obj));
		this.selectedObjects.clear();
	}
	invalidateSelections() {
		this.clearSelection();
		this.prevSelected = null;
	}
	deleteSelection() {
		if(!this.hasSelection()) return;

		const delTasks = [];
		this.selectedObjects.forEach((obj) => delTasks.push(new VLazyTask(this.editor, () => obj.delTask(this.editor))));

		this.editor.taskManager.do('task-delete-selected', VTask.join(delTasks));

		this.invalidateSelections();
	}
	moveSelection(startEvent, endEvent) {
		if(!this.hasSelection()) return;
		// Just clicking at the same position should do nothing.
		if(this.areSamePos(startEvent, endEvent)) return;

		// For multiple objects, horizontal movement is not permitted.
		if(this.selectedObjects.size > 1){
			this.moveSelectionByTick(endEvent.tick - startEvent.tick);
			return;
		}

		let obj = null;
		this.selectedObjects.forEach((o) => { obj = o; });

		const delTask = obj.delTask(this.editor);
		const moveTask = obj.moveTask(this.editor, startEvent, endEvent);

		this.editor.taskManager.do('task-move-selection', VTask.join([delTask, moveTask]));

		this.invalidateSelections();
		this.addToSelection(obj.getMoved(this.editor, startEvent, endEvent));
		this.updatePrevSelected();
	}
	moveSelectionByTick(tick) {
		if(!this.hasSelection()) return;
		if(tick === 0) return;

		const delTasks = [];
		// Force for objects to create task after previous tasks are completed.
		this.selectedObjects.forEach((obj) => delTasks.push(new VLazyTask(this.editor, () => obj.delTask(this.editor))));

		const moveTasks = [];
		this.selectedObjects.forEach((obj) => moveTasks.push(obj.moveTickTask(this.editor, tick)));

		this.editor.taskManager.do('task-move-selection', VTask.join([VTask.join(delTasks), VTask.join(moveTasks)]));

		const oldSelected = this.selectedObjects;

		this.invalidateSelections();
		oldSelected.forEach((obj) => this.addToSelection(obj.getTickMoved(this.editor, tick)));
		this.updatePrevSelected();
	}
	resizeSelectionByTick(tick) {
		if(!this.hasSelection()) return;
		if(tick === 0) return;

		const resizeTasks = [];
		this.selectedObjects.forEach((obj) => resizeTasks.push(obj.resizeTask(this.editor, tick)));

		this.editor.taskManager.do('task-resize-selected', VTask.join(resizeTasks));

		this.selectedObjects.forEach((obj) => obj.sel(this.view, true));
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
