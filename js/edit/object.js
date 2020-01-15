class VEditObject {
	constructor() {}
	sel(view, selected) {}
	delTask(editor) { return null; }
	moveTask(editor, startEvent, endEvent) { return null; }

	fakeMoveTo(view, startEvent, event) {}
	resetFakeMoveTo(view) {}

	serialize() { return []; }
	unserialize(data) {}
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
	moveTask(editor, startEvent, endEvent) {
		return new VNoteMaybeAddTask(editor, this.type, this.lane, this.tick+endEvent.tick-startEvent.tick, this.len);
	}

	fakeMoveTo(view, startEvent, event) {
		view.fakeMoveNoteTo(this.type, this.lane, this.tick, this.lane, this.tick+event.tick-startEvent.tick);
	}
	resetFakeMoveTo(view) {
		view.fakeMoveNoteTo(this.type, this.lane, this.tick, this.lane, this.tick);
	}

	serialize() { return [this.type, this.lane, this.tick, this.len]; }
	unserialize(data) { [this.type, this.lane, this.tick, this.len] = data; }
}
