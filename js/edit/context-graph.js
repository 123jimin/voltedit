class VEditGraphSectionContext extends VEditContext {
	getGraphSections() { return null; }
	createGraphPointObject(tick, graphPoint) { return null; }

	areSamePos(e1, e2) {
		return e1.tick === e2.tick && e1.v === e2.v;
	}
	getObjectAt(event) {
		return this.getObjectByTick(event.tick);
	}
	getObjectByTick(tick) {
		const graphSections = this.getGraphSections();
		if(!graphSections) return null;

		const graph = graphSections.get(tick);
		if(!graph) return null;

		const graphPoint = graph.data.points.getLE(tick - graph.data.iy);
		if(!graphPoint) return null;

		if(!graphPoint.data.edit)
			graphPoint.data.edit = this.createGraphPointObject(graph.data.iy+graphPoint.y, graphPoint);

		return graphPoint.data.edit;
	}
	selectRange(from, to) {
		const graphSections = this.getGraphSections();
		if(!graphSections) return null;

		const graphs = graphSections.getAll(from, to-from);

		const editObjects = [];
		graphs.forEach((graph) => {
			graph.data.points.getAll(from - graph.data.iy, to-from).forEach((point) => {
				if(!point.data.edit) point.data.edit = this.createGraphPointObject(graph.data.iy+point.y, point);
				editObjects.push(point.data.edit);
			});
		});

		editObjects.forEach((obj) => this.addToSelection(obj));
	}
}

class VEditLaserContext extends VEditGraphSectionContext {
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
	getGraphSections() { return this.editor.chartData.getNoteData('laser', this.lane); }
	createGraphPointObject(tick, graphPoint) { return new VLaserGraphPointObject(this.lane, tick, graphPoint); }
	createObjectAt(startEvent, endEvent) {

	}
}
