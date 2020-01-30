/// The chart view manager for the editor
class VView {
	constructor(editor) {
		this.editor = editor;
		this.scale = new VChartScale(this);
		this.color = new VChartColor(this);

		this.elem = editor.elem.querySelector(".chart");
		this.elem.style.width = `${this.scale.elemWidth}px`;

		this.tickUnit = 240*4; /// Ticks per *whole* note
		this.tickLoc = 0; /// Current display location (in ticks)
		this.lastTick = 0; /// Last tick of any elements

		// Two numbers are used for range selection.
		// When range selection is not used, their values are identical.
		this.cursorStartLoc = 0; /// Current low cursor location (in ticks)
		this.cursorEndLoc = 0; /// Current high cursor location (in ticks)

		this._prevNoteWidth = this.scale.noteWidth;
		this.height = 0;

		this.renderQueue = new VViewRenderQueue(this);
		this.scrollBar = new VViewScrollBar(this);
		this.baseLines = new VViewBaseLines(this);

		this.render = new VViewRender(this);
		this._redraw();

		this.elem.addEventListener('wheel', this.onWheel.bind(this), {'passive': true});
		this.elem.addEventListener('mousedown', this.onMouseDown.bind(this));
		this.elem.addEventListener('contextmenu', (e) => e.preventDefault());

		document.addEventListener('mousemove', this.onMouseMove.bind(this), {'passive': true});
		document.addEventListener('mouseup', this.onMouseUp.bind(this), {'passive': true});

		document.addEventListener('touchmove', TOUCH(this.onMouseMove.bind(this)), {'passive': true});
		document.addEventListener('touchcancel', TOUCH(this.onMouseUp.bind(this)), {'passive': true});
		document.addEventListener('touchend', TOUCH(this.onMouseUp.bind(this)), {'passive': true});
	}

	/// Tick to pixel
	t2p(tick) { return tick*this.scale.wholeNote/this.tickUnit; }
	/// Pixel to tick
	p2t(px) { return px*this.tickUnit/this.scale.wholeNote; }

	getTopPixel() { return RD(this.scale.marginBottom-this.t2p(this.tickLoc)-this.height); }

	/// Set the location of the region to be shown (tickLoc = bottom)
	setLocation(tickLoc) {
		this.tickLoc = isFinite(tickLoc) && tickLoc >= 0 ? tickLoc : 0;
		this.renderQueue.push(this._updateLocation, VVIEW_RENDER_PRIORITY.MINOR);
	}
	setCursor(cursorLoc, cursorEndLoc) {
		if(cursorLoc == null) cursorLoc = this.cursorStartLoc;
		if(cursorEndLoc == null) cursorEndLoc = cursorLoc;

		if(!isFinite(cursorLoc) || cursorLoc < 0) cursorLoc = 0;
		if(!isFinite(cursorEndLoc) || cursorEndLoc < 0) cursorEndLoc = 0;

		if(cursorLoc > cursorEndLoc) [cursorLoc, cursorEndLoc] = [cursorEndLoc, cursorLoc];
		[this.cursorStartLoc, this.cursorEndLoc] = [cursorLoc, cursorEndLoc];

		this.renderQueue.push(this._redrawCursor, VVIEW_RENDER_PRIORITY.MINOR);
	}
	redraw() {
		this.renderQueue.push(this._redraw, VVIEW_RENDER_PRIORITY.REDRAW);
	}
	refresh() {
		this.renderQueue.push(NOP, VVIEW_RENDER_PRIORITY.NONE);
	}

	/// Edit tasks
	addNote(type, lane, tick, len) {
		switch(type){
			case 'bt':
				this.render.addBtNote(lane, tick, len);
				break;
			case 'fx':
				this.render.addFxNote(lane, tick, len);
				break;
		}

		this._checkRedrawMesaures(tick);
		this.refresh();
	}
	addLaser(lane, point) {
		this.render.addLaser(lane, point, point.data.connected ? point.next() : null);

		this._checkRedrawMesaures(point.y);
		this.refresh();
	}
	delNote(type, lane, tick) {
		switch(type){
			case 'bt':
				this.render.delBtNote(lane, tick);
				break;
			case 'fx':
				this.render.delFxNote(lane, tick);
				break;
		}
		this.refresh();
	}
	delLaser(lane, tick) {
		if(tick < 0) return;
		this.render.delLaser(lane, tick);
		this.refresh();
	}
	selNote(type, lane, tick, selected) {
		switch(type){
			case 'bt':
				this.render.selBtNote(lane, tick, selected);
				break;
			case 'fx':
				this.render.selFxNote(lane, tick, selected);
				break;
		}
		this.refresh();
	}
	selLaserSlam(lane, tick, slam) {
		this.render.selLaserSlam(lane, tick, slam);
		this.refresh();
	}
	selLaserEdge(lane, tick, edge) {
		this.render.selLaserEdge(lane, tick, edge);
		this.refresh();
	}
	selLaserEditPoint(lane, tick, isVF, selected) {
		this.render.selLaserEditPoint(lane, tick, isVF, selected);
		this.refresh();
	}

	getLaserCallbacks(lane) {
		return (add, update, delTick) => {
			if(add) this.addLaser(lane, add);
			if(update) this.updateLaser(lane, update);
			if(delTick >= 0) this.delLaser(lane, delTick);
		};
	}
	updateLaser(lane, point) {
		if(!point) return;
		this.render.updateLaser(lane, point, point.data.connected ? point.next() : null);
		this.refresh();
	}
	/// Updates connected lasers
	updateConnectedLasers(lane, points) {
		let nextPoint = null;
		for(let i=points.length; i--;){
			const currPoint = points[i];
			this.render.updateLaser(lane, currPoint, nextPoint);
			nextPoint = currPoint;
		}
	}
	fakeMoveNoteTo(type, lane, tick, newLane, newTick) {
		switch(type){
			case 'bt':
				this.render.fakeMoveBtNoteTo(lane, tick, newLane, newTick);
				break;
			case 'fx':
				this.render.fakeMoveFxNoteTo(lane, tick, newLane, newTick);
				break;
		}
		this._checkRedrawMesaures(newTick);
		this.refresh();
	}

	showNoteDrawing(type, lane, tick, len) {
		if(len < 0){
			tick += len;
			len = -len;
		}
		if(tick < 0) tick = 0;
		switch(type){
			case 'bt':
				if(len) this.render.showBTLongDrawing(lane, tick, len);
				else this.render.showBTDrawing(lane, tick);
				break;
			case 'fx':
				if(len) this.render.showFXLongDrawing(lane, tick, len);
				else this.render.showFXDrawing(lane, tick);
				break;
		}
		this._checkRedrawMesaures(tick+len);
		this.refresh();
	}
	showLaserDrawing(lane, tick, connectPrev, point) {
		const laserData = this.editor.chartData && this.editor.chartData.getNoteData('laser', lane);
		if(!laserData) return;

		const prevNode = connectPrev ? laserData.getLE(tick) : null;
		const nextNode = laserData.getGE(tick+1);

		this.render.showLaserDrawing(lane, tick, prevNode, nextNode, point);

		this._checkRedrawMesaures(tick);
		this.refresh();
	}
	hideDrawing() {
		this.render.hideDrawing();
		this.refresh();
	}

	/// Clear and redraw everything.
	_redraw() {
		this.tickUnit = this.editor.getTicksPerWholeNote() || 240*4;
		this.lastTick = this.editor.chartData ? this.editor.chartData.getLastTick() : 0;

		this._resize();

		this._redrawNotes();
		this._redrawLasers();

		this._updateLocation();

		this._redrawMeasures();
		this._redrawTickProps();
		this._redrawEditorUI();
	}
	_redrawNotes() {
		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		this.render.clearNotes();
		if(noteData.bt) noteData.bt.forEach((btData, lane) => {
			btData.traverse((node) => {
				this.render.addBtNote(lane, node.y, node.l);
			})
		});
		if(noteData.fx) noteData.fx.forEach((fxData, lane) => {
			fxData.traverse((node) => {
				this.render.addFxNote(lane, node.y, node.l);
			})
		});
	}
	_redrawLasers() {
		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		this.render.clearLasers();

		const laserData = noteData.laser;
		if(!laserData) return;

		laserData.forEach((tree, lane) => {
			let prevNode = null;
			tree.traverse((node) => {
				if(prevNode) this.render.addLaser(lane, prevNode, prevNode.data.connected ? node : null);
				prevNode = node;
			});
			if(prevNode) this.render.addLaser(lane, prevNode, null);
		});
	}
	_checkRedrawMesaures(tick) {
		const newLastTick = Math.max(tick || 0, this.editor.chartData ? this.editor.chartData.getLastTick() : 0);
		if(this.lastTick < newLastTick){
			this.lastTick = newLastTick;
			this.renderQueue.push(this._redrawMeasures, VVIEW_RENDER_PRIORITY.MINOR);
		}
	}
	_redrawMeasures() {
		this.render.clearMeasures();

		// Let's draw the very first line.
		this.render.addMeasureLine(0);

		if(!this.editor.chartData) return;

		const beatInfo = this.editor.chartData.beat;
		if(!beatInfo || !beatInfo.time_sig) return;

		let endTick = this.editor.chartData.iterMeasures((measureIndex, measureTick, n, d, currMeasureLength) => {
			// Draw a measure line and beat lines.
			if(measureIndex > 0) {
				this.render.addMeasureLine(measureTick);
			}

			for(let i=1; i<n; ++i) {
				this.render.addBeatLine(measureTick + i*(this.tickUnit / d));
			}
		}, this.lastTick);

		if(endTick > 0){
			this.render.addMeasureLine(endTick);
		}
	}
	_redrawTickProps() {
		this.render.clearTickProps();

		if(!this.editor.chartData) return;

		const beatInfo = this.editor.chartData.beat;
		if(!beatInfo) return;

		if(beatInfo.bpm){
			beatInfo.bpm.traverse((node) => {
				this.render.addBPMChanges(node.y, node.data);
			});
		}

		// While this is a little bit inefficient (already done in _redrawMeasures),
		// iterating measures at here one more time is more robust.
		if(beatInfo.time_sig) {
			let measureTick = 0;
			let prevMeasureInd = 0;
			let currMeasureLength = this.tickUnit;
			beatInfo.time_sig.forEach((sig) => {
				measureTick += (sig.idx-prevMeasureInd) * currMeasureLength;
				prevMeasureInd = sig.idx;
				currMeasureLength = sig.v.n * this.tickUnit / sig.v.d;

				this.render.addTimeSig(measureTick, sig.v.n, sig.v.d);
			});
		}

	}
	_redrawEditorUI() {
		this._redrawCursor();
	}
	_redrawCursor() {
		this.render.setCursor(this.cursorStartLoc, this.cursorEndLoc);
	}

	/// Update the size of the SVG, but do not redraw everything.
	resize() {
		this.renderQueue.push(this._resize, VVIEW_RENDER_PRIORITY.RESIZE);
	}
	_resize() {
		this.elem.style.width = `${this.scale.elemWidth}px`;
		this.height = this.elem.clientHeight;

		this.baseLines.resize();
		this.render.resize();

		this._updateLocation();
		this._updateNoteWidth();
	}
	_updateNoteWidth() {
		if(this._prevNoteWidth === this.scale.noteWidth) return;
		this._prevNoteWidth = this.scale.noteWidth;

		this.baseLines.updateNoteWidth();
	}

	onMouseDown(event) {
		if(this.elem.contains(event.target) && !this.scrollBar.elem.contains(event.target)){
			this.editor.context.onMouseDown(this.toChartViewEvent(event));
		}
	}
	onMouseMove(event) {
		if(event.which === 0){
			this.editor.context.onMouseHover(this.toChartViewEvent(event));
		}
		if(this.scrollBar.scrolling){
			this.scrollBar.trigger(event.pageY);
			return;
		}
		this.editor.context.onMouseDrag(this.toChartViewEvent(event));
	}
	onMouseUp(event) {
		if(this.scrollBar.scrolling){
			this.scrollBar.trigger(event.pageY);
			this.scrollBar.stopScroll();
		}

		this.editor.context.onMouseUp(this.toChartViewEvent(event));
	}
	onWheel(event) {
		if(!this.editor.chartData || !this.editor.chartData.beat) return;

		const deltaTick = this.tickUnit / 16;
		if(event.deltaY < 0) {
			this.setLocation(this.tickLoc+deltaTick);
		} else if(event.deltaY > 0) {
			this.setLocation(this.tickLoc-deltaTick);
		}
	}
	getClickCoord(x, y) {
		let column = Math.floor((x-this.scale.marginSide/2)/this.scale.columnOffset);
		column = CLIP(column, 0, this.scale.columns-1);

		const effectivePos = y-column*this.height;
		const tick = -this.p2t(this.getTopPixel()+effectivePos);

		const columnCenter = this.scale.marginSide+this.scale.columnRight+column*this.scale.columnOffset;
		const offsetX = (x-columnCenter)/this.scale.noteWidth;

		const laneCount = (this.editor.chartData && this.editor.chartData.getLaneCount('bt')) || 4;
		let lane = Math.floor(offsetX);
		lane = CLIP(lane+2, -1, laneCount);
		const laser = 0.5 + offsetX/(laneCount+1);

		return [tick, lane, laser];
	}
	toChartViewEvent(event) {
		const coord = this.getClickCoord(event.offsetX, event.offsetY);
		let v = coord[2];
		if(this.editor.laserSnap > 0){
			if(v !== 0 && v !== 1 && v !== -1) v = ALIGN(1/this.editor.laserSnap, v);
		}
		return {
			'tick': ALIGN(this.editor.editSnapTick, coord[0]), 'lane': coord[1], 'v': v,
			'which': event.which, 'ctrlKey': event.ctrlKey, 'altKey': event.altKey, 'shiftKey': event.shiftKey,
		};
	}
	_updateLocation() {
		// this.svg.viewbox(this.scale.viewBoxLeft, this._getViewBoxTop(), this.scale.fullWidth, this.height);
		this.render.updateLocation();
		this.baseLines.update();
		this.scrollBar.update();
	}
}
