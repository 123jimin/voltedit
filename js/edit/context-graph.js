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
		// TODO: the UX must be improved significantly
		const newPoint = {
			'v': CLIP(startEvent.v, 0, 1),
			'vf': CLIP(endEvent.v, 0, 1),
			'connected': false,
			'wide': 1,
			'a': 0, 'b': 0,
		};

		const points = this.getPoints();
		if(!points) return null;

		let prevPoint = null;
		// Check that whether `startEvent` can be connected to `prevPoint`
		if(this.prevSelected && (this.prevSelected instanceof VLaserEditPoint)){
			if(this.prevSelected.tick < startEvent.tick){
				prevPoint = this.prevSelected.getGraphPoint(this.editor);
				if(prevPoint && !prevPoint.data.connected){
					const prevNextPoint = prevPoint.next();
					if(prevNextPoint && prevNextPoint.y < startEvent.tick){
						prevPoint = null;
					}
				}
			}
		}

		let connectPrev = true;
		if(!prevPoint){
			prevPoint = points.getLE(startEvent.tick);
			connectPrev = prevPoint ? prevPoint.data.connected : false;
		}

		if(prevPoint){
			newPoint.connected = prevPoint.data.connected;
			newPoint.wide = prevPoint.data.wide;
		}
		
		const addTask = new VGraphPointAddTask(this.editor, points, this.view.getLaserCallbacks(this.lane),
			startEvent.tick, newPoint, connectPrev);

		if(!addTask) return null;
		if(!this.editor.taskManager.do(`task-add-laser-point`, addTask)) return null;

		const origV = startEvent.v; startEvent.v = newPoint.vf;
		const created = this.getObjectAt(startEvent);
		startEvent.v = origV;

		if(created) this.addToSelection(created);
		return created;
	}
}
