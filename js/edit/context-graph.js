class VEditGraphContext extends VEditContext {
	getPoints() { return null; }
	createGraphPointObject(tick, point) { return null; }
	areSamePos(e1, e2) {
		return e1.tick === e2.tick && e1.v === e2.v;
	}
	
	getObjectAt(event) {
		return this.getObjectByTick(event.tick);
	}
	getObjectByTick(tick) {
		const points = this.getPoints();
		if(!points) return null;

		const point = points.getLE(tick);
		if(!point) return null;

		const nextPoint = point.next();
		if(!point.data.connected || !nextPoint){
			if(tick !== point.y) return null;
		}

		if(!point.data.edit)
			point.data.setEdit(this.createGraphPointObject(point.y, point));

		return point.data.edit;
	}
	selectRange(from, to) {
		const points = this.getPoints();
		if(!points) return null;

		points.getAll(from, to-from).forEach((point) => {
			if(!point.data.edit) point.data.setEdit(this.createGraphPointObject(point.y, point));
			this.addToSelection(point.data.edit);
		});
	}
}

class VEditLaserContext extends VEditGraphContext {
	constructor(editor, lane) {
		super(editor, `laser-${['left','right'][lane]}`);
		this.lane = lane;
		this.wide = false;
	}
	canMakeObjectAt(event) {
		return event.tick >= 0 && event.v >= 0 && event.v <= 1;
	}
	areSamePos(e1, e2) {
		return e1.tick === e2.tick &&
			ALIGN(this.editor.laserSnap, e1.v) === ALIGN(this.editor.laserSnap, e2.v);
	}
	getPoints() { return this.editor.chartData.getNoteData('laser', this.lane); }
	createGraphPointObject(tick, point) { return new VLaserGraphPointObject(this.lane, tick, point); }
	createObjectAt(startEvent, endEvent) {

	}
}
