class VEditGraphContext extends VEditContext {
	getPoints() { return null; }
	makeEdits(point) {}
	createGraphPointObject(tick, event) { return null; }
	createObjectAt(startEvent, endEvent) { return null; }
	areSamePos(e1, e2) {
		return e1.tick === e2.tick && e1.v === e2.v;
	}
	
	getObjectAt(event) {
		const points = this.getPoints();
		if(!points) return null;

		const point = points.get(event.tick);
		if(!point) return null;

		this.makeEdits(point);

		if(!point.data.editVF) return point.data.editV;

		const vDist = Math.abs(event.v - point.data.v);
		const vfDist = Math.abs(event.v - point.data.vf);

		return vDist < vfDist ? point.data.editV : point.data.editVF;
	}
	getGraphPointEdits(point) {
		this.makeEdits(point);
		if(point.data.isSlam()) return [point.data.editV, point.data.editVF];
		else return [point.data.editV];
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
		return event.tick >= 0 && event.v >= 0 && event.v <= 1;
	}
	getPoints() { return this.editor.chartData.getNoteData('laser', this.lane); }
	getGraphPointEdits(point) {
		this.makeEdits(point);
		if(point.data.isSlam()) return [point.data.editV, point.data.editVF];
		else return [point.data.editV];
	}
	makeEdits(point) {
		if(!point.data.editV) point.data.setEditV(new VLaserEditPoint(this.lane, point, false));
		if(point.data.isSlam() && !point.data.editVF) point.data.setEditVF(new VLaserEditPoint(this.lane, point, true));
	}
	createObjectAt(startEvent, endEvent) {

	}
}
