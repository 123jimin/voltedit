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
		this.lastPlayTick = 0; /// Last tick of notes/laser

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
		this.cursorStartLoc = this.cursorEndLoc = isFinite(cursorLoc) && cursorLoc > 0 ? cursorLoc : 0;
		this.renderQueue.push(this._redrawCursor, VVIEW_RENDER_PRIORITY.MINOR);
	}
	redraw() {
		this.renderQueue.push(this._redraw, VVIEW_RENDER_PRIORITY.REDRAW);
	}

	/// Clear and redraw everything.
	_redraw() {
		this.tickUnit = this.editor.getTicksPerWholeNote() || 240*4;
		this.lastPlayTick = 0;

		this._resize();

		this._redrawNotes();
		this._redrawLasers();

		// Call after notes and lasers are drawn, to use updated lastPlayTick.
		this._updateLocation();

		this._redrawMeasures();
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
				this._setLastPlayTick(node.y + node.l);
			})
		});
		noteData.fx.forEach((fxData, lane) => {
			fxData.traverse((node) => {
				this.render.addFxNote(lane, node.y, node.l);
				this._setLastPlayTick(node.y + node.l);
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

		const lastTick = this.getLastTick();

		let measureTick = 0;
		let measureIndex = 0;

		// Will be changed to 0 in the first loop
		let currTimeSigInd = -1;

		while(currTimeSigInd+1 < beatInfo.time_sig.length || measureTick <= lastTick) {
			if(currTimeSigInd+1 < beatInfo.time_sig.length) {
				const nextTimeSig = beatInfo.time_sig[currTimeSigInd+1];
				if(nextTimeSig.idx <= measureIndex) {
					++currTimeSigInd;
				}
			}
			const currTimeSig = beatInfo.time_sig[currTimeSigInd];
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
			this.render.addMeasureLine(this.t2p(measureTick));
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

	_setLastPlayTick(lastPlayTick) {
		if(this.lastPlayTick < lastPlayTick)
			this.lastPlayTick = lastPlayTick;
	}

	/// Computes the last tick of anything.
	getLastTick() {
		// Assumes that notes and lasers have been already taken into account.
		let lastTick = this.lastPlayTick;
		const check = (tick) => { if(lastTick < tick) lastTick = tick; };
		const checkArr = (arr) => { if(arr && arr.length) check(arr[arr.length-1].y); };

		const beatInfo = this.editor.chartData ? this.editor.chartData.beat : null;
		if(beatInfo) {
			checkArr(beatInfo.bpm);

			if(beatInfo.time_sig && beatInfo.time_sig.length > 0) {
				let measureTick = 0;
				let prevMeasureInd = 0;
				let prevMeasureLen = 0;

				beatInfo.time_sig.forEach((sig) => {
					measureTick += (sig.idx - prevMeasureInd) * prevMeasureLen;
					prevMeasureInd = sig.idx;
					prevMeasureLen = sig.v.d * (beatInfo.resolution*4) / sig.v.n;
				});

				check(measureTick);
			}

			if(beatInfo.scroll_speed && beatInfo.scroll_speed.length > 0) {
				// TODO: check scroll speed
			}
		}

		return lastTick;
	}
}
