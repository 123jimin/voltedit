const VCONTEXT_MODE = Object.freeze({

});

class VEditContext {
	constructor(editor) {
		this.editor = editor;
		this.view = this.editor.view;

		this.dragStarted = false;
		this.startTick = 0;
		this.startLane = 0;
		this.startV = 0;

		this.selectedObjects = new Set();
	}
	clearSelection() {
		this.selectedObjects.forEach((obj) => obj.sel(this.view, false));
		this.selectedObjects.clear();
	}
	deleteSelection() {
		if(this.selectedObjects.size === 0) return;

		let delTasks = [];
		this.selectedObjects.forEach((obj) => delTasks.push(obj.delTask(this.editor)));

		if(delTasks.length === 1) this.editor.taskManager.do(delTasks[0]);
		else this.editor.taskManager.do(new VTaskCollection(this.editor, delTasks));
	}
	getObjectAt(event) {
		return null;
	}
	/// tick: y-value, lane and v: x-value
	/// lane can be -1 or 4 (out of range)
	/// x-value: 0.0 for left laser pos, and 1.0 for right laser pos
	onMouseDown(event) {
		this.dragStarted = true;
		this.startTick = event.tick;
		this.startLane = event.lane;
		this.startLaser = event.v;

		const obj = this.getObjectAt(event);
		if(!obj || !this.selectedObjects.has(obj)){
			if(!event.shiftKey) this.clearSelection();
			if(!obj){
				this.view.setCursor(event.tick);
				return;
			}
		}

		this.selectedObjects.add(obj);
		obj.sel(this.view, true);
	}
	onMouseDrag(event) {
	}
	onMouseUp(event) {
		this.dragStarted = false;
	}
}

class VEditChartContext extends VEditContext {
	constructor(editor) {
		super(editor);
	}
}

class VEditNoteContext extends VEditContext {
	constructor(editor, type) {
		super(editor);
		this.type = type;
		this.draggingNote = false;
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
	constructor(editor, isRightSide) {
		super(editor);
		this.isRightSide = isRightSide;
	}
}
