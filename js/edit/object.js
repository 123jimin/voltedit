class VEditObject {
	constructor() {}
	sel(view, selected) {}
}

class VNoteObject extends VEditObject {
	constructor(type, lane, tick, len) {
		super();
		this.type = type;
		this.lane = lane;
		this.tick = tick;
		this.len = len;
	}
	sel(view, selected) {
		view.selNote(this.type, this.lane, this.tick, selected);
	}
	delTask(editor) {
		return new VNoteDelTask(editor, this.type, this.lane, this.tick);
	}
}