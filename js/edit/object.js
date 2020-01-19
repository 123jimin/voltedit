class VEditObject {
	constructor() {}
	sel(view, selected) {}
	delTask(editor) { return null; }
	moveTask(editor, startEvent, endEvent) { return null; }
	getMoved(editor, startEvent, endEvent) { return null; }

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
	getMoved(editor, startEvent, endEvent) {
		if(!editor.chartData) return null;

		const noteData = editor.chartData.getNoteData(this.type, this.lane);
		if(!noteData) return null;

		const newY = this.tick+endEvent.tick-startEvent.tick;
		const data = noteData.get(newY);
		if(!data || data.y !== newY || data.l !== this.len) return null;

		return data.data;
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
