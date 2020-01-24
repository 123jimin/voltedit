class VEditGraphContext extends VEditContext {
	getPoints() { return null; }
	getGraphPointEdits(point) { return []; }
	getGraphPointEditByTick(point, tick) { return null; }
	createGraphPointObject(tick, event) { return null; }
	areSamePos(e1, e2) {
		return e1.tick === e2.tick && e1.v === e2.v;
	}
	
	getObjectAt(event) {
		return this.getObjectByTick(event.tick);
	}
	createObjectAt(startEvent, endEvent) {
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

		return this.getGraphPointEditByTick(point, tick);

		/*
		if(!point.data.edit)
			point.data.setEdit(this.createGraphPointObject(point.y, point));

		return point.data.edit;
		*/
	}
	selectRange(from, to) {
		const points = this.getPoints();
		if(!points) return null;

		points.getAll(from, to-from).forEach((point) => {
			this.getGraphPointEdits(point).forEach((edit) => this.addToSelection(edit));
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
		const aligned = ALIGN(this.editor.laserSnap, event.v);
		return event.tick >= 0 && aligned >= 0 && aligned <= 1;
	}
	areSamePos(e1, e2) {
		return e1.tick === e2.tick &&
			ALIGN(this.editor.laserSnap, e1.v) === ALIGN(this.editor.laserSnap, e2.v);
	}
	getPoints() { return this.editor.chartData.getNoteData('laser', this.lane); }
	getGraphPointEdits(point) {
		this._makeEdits(point);
		if(point.data.isSlam()) return [point.data.editV, point.data.editVF];
		else return [point.data.editV];
	}
	getGraphPointEditByTick(point, tick) {
		return null;
	}
	_makeEdits(point) {
		if(!point.data.editV) point.data.setEditV(new VLaserEditPoint(this.lane, point, false));
		if(point.data.isSlam() && !point.data.editVF) point.data.setEditVF(new VLaserEditPoint(this.lane, point, true));
	}
	createObjectAt(startEvent, endEvent) {

	}
}
