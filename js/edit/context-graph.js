class VEditGraphContext extends VEditContext {
	constructor(editor, contextId) {
		super(editor, contextId);
		this.STR_TASK_ADD_POINT = 'task-add-graph-point';
		this.STR_TASK_ADJUST_SLAM = 'task-adjust-graph-slam';
	}
	getPoints() { return null; }
	_getEditCallbacks() { return null; }
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

		const vDist = Math.abs(event.v - point.data.v * point.data.wide);
		const vfDist = Math.abs(event.v - point.data.vf * point.data.wide);

		const maxAllowedDist = 1/this.editor.laserSnap;
		if(vDist > maxAllowedDist && vfDist > maxAllowedDist) return null;

		return vDist < vfDist ? point.data.getBeginEdit() : point.data.getEndEdit();
	}

	_forceConnectWhenCreate(tick) {
		if(!this.prevSelected) return false;

		const points = this.getPoints();
		const prevPoint = points.getLE(tick-1);

		return prevPoint && prevPoint.data.getEndEdit() === this.prevSelected;
	}
	createObjectAt(startEvent, endEvent) {
		const newPoint = {
			'v': CLIP(startEvent.v, 0, 1),
			'vf': CLIP(endEvent.v, 0, 1),
			'connected': false,
			'wide': 1,
			'a': 0, 'b': 0,
		};

		const addTick = startEvent.tick;

		const points = this.getPoints();
		if(!points) return null;

		const prevPoint = points.getLE(addTick);
		if(prevPoint && prevPoint.y === addTick){
			const adjustSlamTask = new VGraphPointChangeSlamTask(this.editor, points, (point) => this._getEditCallbacks()(null, point, -1),
				prevPoint.y, prevPoint.data.v, newPoint.vf, true);
			if(!this.editor.taskManager.do(this.STR_TASK_ADJUST_SLAM, adjustSlamTask)) return null;

			// The point reference is not invalidated, so this is fine.
			const endEdit = prevPoint.data.getEndEdit();
			if(endEdit) this.addToSelection(endEdit);
			return endEdit;
		}

		const forceConnect = this._forceConnectWhenCreate(addTick);
		let connectPrev = false;
		if(prevPoint){
			newPoint.connected = prevPoint.data.connected;
			newPoint.wide = prevPoint.data.wide;
			connectPrev = forceConnect || prevPoint.data.connected;
		}

		const addTask = new VGraphPointAddTask(this.editor, points, this._getEditCallbacks(), addTick, newPoint, connectPrev);

		if(!addTask) return null;
		if(!this.editor.taskManager.do(this.STR_TASK_ADD_POINT, addTask)) return null;

		const origV = startEvent.v; startEvent.v = newPoint.vf;
		const created = this.getObjectAt(startEvent);
		startEvent.v = origV;

		if(created) this.addToSelection(created);

		return created;
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
		super(editor, `laser-${lane < 2 ? ['left','right'][lane] : (lane+1).toString()}`);
		this.lane = lane;
		this.wide = false;

		this.STR_TASK_ADD_POINT = 'task-add-laser-point';
		this.STR_TASK_ADJUST_SLAM = 'task-adjust-laser-slam';
	}
	_showLaserDrawing(tick, startV, endV) {
		this.view.showLaserDrawing(this.lane, tick, this._forceConnectWhenCreate(tick),
			new VGraphPoint({'v': startV, 'vf': endV,'connected': false, 'wide': this.wide}));
	}
	_showHoverDrawing(event) {
		if(!this.canMakeObjectAt(event)) return false;
		let startV = event.v;
		if(this.prevSelected && (this.prevSelected instanceof VLaserEditPoint)){
			const point = this.prevSelected.getGraphPoint(this.editor);
			if(point.y === event.tick) startV = point.data.v;
		}
		this._showLaserDrawing(event.tick, startV, event.v);
		return true;
	}
	_showDragDrawing(event) {
		if(!this.canMakeObjectAt(event) || !this.canMakeObjectAt(this.startEvent)) return false;
		this._showLaserDrawing(this.startEvent.tick, this.startEvent.v, event.v);
		return true;
	}
	canMakeObjectAt(event) {
		return event.tick >= 0 && event.v >= 0 && event.v <= 1;
	}
	getPoints() { return this.editor.chartData.getNoteData('laser', this.lane); }
	_getEditCallbacks() { return this.view.getLaserCallbacks(this.lane); }
	getGraphPointEdits(point) {
		this.makeEdits(point);
		if(point.data.isSlam()) return [point.data.editV, point.data.editVF];
		else return [point.data.editV];
	}
	makeEdits(point) {
		if(!point.data.editV) point.data.setEditV(new VLaserEditPoint(this.lane, point, false));
		if(point.data.isSlam() && !point.data.editVF) point.data.setEditVF(new VLaserEditPoint(this.lane, point, true));
	}
}
