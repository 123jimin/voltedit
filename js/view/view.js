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
	setCursor(cursorLoc) {
		if(cursorLoc == null) cursorLoc = this.cursorStartLoc;
		this.cursorStartLoc = this.cursorEndLoc = isFinite(cursorLoc) && cursorLoc > 0 ? cursorLoc : 0;
		this.renderQueue.push(this._redrawCursor, VVIEW_RENDER_PRIORITY.MINOR);
	}
	redraw() {
		this.renderQueue.push(this._redraw, VVIEW_RENDER_PRIORITY.REDRAW);
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
		noteData.bt.forEach((btData, lane) => {
			btData.traverse((node) => {
				this.render.addBtNote(lane, node.y, node.l);
			})
		});
		noteData.fx.forEach((fxData, lane) => {
			fxData.traverse((node) => {
				this.render.addFxNote(lane, node.y, node.l);
			})
		});
	}
	_redrawLasers() {
		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		const laserData = noteData.laser;
		if(!laserData) return;

		this.render.clearLasers();
		laserData.forEach((tree, ind) => {
			tree.traverse((node) => {
				this.render.addLaser(ind, node.y, node.data);
			});
		});
	}
	_redrawMeasures() {
		this.render.clearMeasures();

		// Let's draw the very first line.
		this.render.addMeasureLine(0);

		if(!this.editor.chartData) return;

		const beatInfo = this.editor.chartData.beat;
		if(!beatInfo || !beatInfo.time_sig) return;

		let measureTick = 0;
		let measureIndex = 0;

		let currTimeSigInd = -1;

		while(currTimeSigInd+1 < beatInfo.time_sig.length || measureTick <= this.lastTick) {
			if(currTimeSigInd+1 < beatInfo.time_sig.length) {
				const nextTimeSig = beatInfo.time_sig[currTimeSigInd+1];
				if(nextTimeSig.idx <= measureIndex) {
					++currTimeSigInd;
				}
			}
			const currTimeSig = currTimeSigInd >= 0 ? beatInfo.time_sig[currTimeSigInd] : {'v': {'n': 4, 'd': 4}};
			const currMeasureLength = currTimeSig.v.n * this.tickUnit / currTimeSig.v.d;

			// Draw a measure line and beat lines.
			if(measureIndex > 0) {
				this.render.addMeasureLine(measureTick);
			}

			for(let i=1; i<currTimeSig.v.n; ++i) {
				this.render.addBeatLine(measureTick + i*(this.tickUnit / currTimeSig.v.d));
			}

			++measureIndex;
			measureTick += currMeasureLength;
		}

		// Draw the very last line.
		if(measureTick > 0) {
			this.render.addMeasureLine(measureTick);
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
			this.setCursorWithMouse(event.offsetX, event.offsetY);
		}
	}
	onMouseMove(event) {
		if(event.which === 0) return;
		if(this.scrollBar.scrolling){
			this.scrollBar.trigger(event.pageY);
			return;
		}
	}
	onMouseUp(event) {
		if(this.scrollBar.scrolling){
			this.scrollBar.trigger(event.pageY);
			this.scrollBar.stopScroll();
		}
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
	setCursorWithMouse(x, y) {
		let clickTick = this.getTick(x, y);
		clickTick = ALIGN(this.editor._editSnapTick, clickTick);
		this.setCursor(clickTick);
	}
	getTick(x, y) {
		let column = Math.floor(x/this.scale.columnOffset);
		if(column >= this.scale.columns) column = this.scale.columns-1;

		const effectivePos = y-column*this.height;
		return -this.p2t(this.getTopPixel()+effectivePos);
	}
	_updateLocation() {
		// this.svg.viewbox(this.scale.viewBoxLeft, this._getViewBoxTop(), this.scale.fullWidth, this.height);
		this.render.updateLocation();
		this.baseLines.update();
		this.scrollBar.update();
	}
}
