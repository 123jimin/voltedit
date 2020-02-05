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

		const addTask = new VNoteForceAddTask(this.editor, this.type, lane, startTick, len);
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
