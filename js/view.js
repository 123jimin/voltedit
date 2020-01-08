const CHARTV_RENDER_PRIORITY = Object.freeze({
	'NONE': 0,
	'MINOR': 1,
	'RESIZE': 2,
	'REDRAW': 3
});

/// Manager for chart scales
class VChartScale {
	constructor(view) {
		this.view = view;
		this.editor = view.editor;
		this.load();
	}

	load() {
		const settings = this.editor.settings;

		this.columns = settings.get('editor:columns');
		this.noteWidth = settings.get('editor:note:width');
		this.btNoteHeight = 2;
		this.fxNoteHeight = 3;
		this.laserSlamRatio = 1;

		this.marginSide = settings.get('editor:margin:side');
		this.marginBottom = settings.get('editor:margin:bottom');
		this.measureScale = settings.get('editor:measure:scale');

		this.scrollBarWidth = 12;

		this._computeRests();
	}
	setNoteWidth(value) {
		this.noteWidth = value;
		this._computeRests();
		this.view.redraw();
	}
	setMarginSide(value) {
		this.marginSide = value;
		this._computeRests();
		this.view.resize();
	}
	setMarginBottom(value) {
		this.marginBottom = value;
		this._computeRests();
		this.view.resize();
	}
	setMeasureScale(value) {
		this.measureScale = value;
		this._computeRests();
		this.view.redraw();
	}
	setColumns(value) {
		this.columns = value;
		this._computeRests();
		this.view.redraw();
	}

	_computeRests() {
		this.wholeNote = this.noteWidth*this.measureScale;

		this.columnOffset = this.noteWidth*11+this.marginSide;
		this.fullWidth = this.columnOffset*this.columns + this.marginSide;
		this.elemWidth = this.fullWidth + this.scrollBarWidth;

		this.viewBoxLeft = -(this.noteWidth*5.5+this.marginSide);

		this.laserPosWidth = 5*this.noteWidth;
		this.laserSlamHeight = this.laserSlamRatio * this.noteWidth - 2;

		this.laneWidth = 4*this.noteWidth;
		this.laneLeft = -2*this.noteWidth;
		this.laneRight = +2*this.noteWidth;
	}
}

/// Manager for chart colors
class VChartColor {
	constructor(view) {
		this.view = view;
		this.editor = view.editor;
		this.load();
	}

	load() {
		this.hueLaserLeft = 180;
		this.hueLaserRight = 300;

		this.btFill = '#FFF';
		this.btBorder = '#AAA';
		this.btLong = '#EEE';

		this.fxFill = '#F90';
		this.fxBorder = '#A40';
		this.fxLong = '#EA0';

		this.measureLine = '#FF0';
		this.beatLine = '#444';
		this.baseLines = '#555';
		this.cursor = '#F00';

		this.textTimeSig = '#9E4';
		this.textBPM = '#6AF'
	}
}

/// The view for the chart
class VView {
	constructor(editor) {
		this.editor = editor;
		this.scale = new VChartScale(this);
		this.color = new VChartColor(this);

		this.elem = editor.elem.querySelector(".chart");
		this.elem.style.width = `${this.scale.elemWidth}px`;

		this.scrollBar = this.elem.querySelector(".chart-scrollbar");
		this._scrollTickPerPixel = 0;
		this._scrolling = false;
		this._scrollInitTickLoc = 0;
		this._scrollInitMouseY = 0;

		this.tickUnit = 240*4; /// Ticks per *whole* note

		this.tickLoc = 0; /// Current display location (in ticks)

		// Two numbers are used for range selection.
		// Usually, their values are identical.
		this.cursorLowLoc = 0; /// Current low cursor location (in ticks)
		this.cursorHighLoc = 0; /// Current high cursor location (in ticks)

		this.lastPlayTick = 0; /// Last tick of notes/laser

		this._prevNoteWidth = this.scale.noteWidth;
		this._height = 0;

		this._baseLines = {
			'svg': this.elem.querySelector('.chart-baselines'),
			'master': null, 'elem': null, 'lines': [],
			'copies': null, 'copiesArr': [],
			'currHeight': 100,
			'bottomOffset': 0,
		};
		this._createBaseLines();

		this._currRender = [];
		this._currRenderPriority = CHARTV_RENDER_PRIORITY.NONE;

		this._redraw();

		this.elem.addEventListener('wheel', this.onWheel.bind(this), {'passive': true});
		this.elem.addEventListener('mousedown', this.onMouseDown.bind(this));

		this.scrollBar.addEventListener('mousedown', this.startScroll.bind(this));
		document.addEventListener('mousemove', this.onMouseMove.bind(this), {'passive': true});
		document.addEventListener('mouseup', this.onMouseUp.bind(this), {'passive': true});
	}

	/// Tick to pixel
	t2p(tick) { return tick*this.scale.wholeNote/this.tickUnit; }
	/// Pixel to tick
	p2t(px) { return px*this.tickUnit/this.scale.wholeNote; }

	getTopPixel() { return RD(this.scale.marginBottom-this.t2p(this.tickLoc)-this._height); }

	/// Set the location of the region to be shown (tickLoc = bottom)
	setLocation(tickLoc) {
		this.tickLoc = isFinite(tickLoc) ? tickLoc : 0;
		this._requestAnimationFrame(this._updateLocation, CHARTV_RENDER_PRIORITY.MINOR);
	}
	setCursor(cursorLoc) {
		this.cursorLowLoc = this.cursorHighLoc = isFinite(cursorLoc) && cursorLoc > 0 ? cursorLoc : 0;
		this._requestAnimationFrame(this._redrawCursor, CHARTV_RENDER_PRIORITY.MINOR);
	}
	redraw() {
		this._requestAnimationFrame(this._redraw, CHARTV_RENDER_PRIORITY.REDRAW);
	}

	/// Clear and redraw everything.
	_redraw() {
		this.tickUnit = this.editor.getTicksPerWholeNote() || 240*4;

		this._resize();

		this.lastPlayTick = 0;
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

		/*
		const putNotes = (type, shorts, longs, lane, x, data) => {
			const shortTypeHref = `#${type}Short`;
			const longTypeHref = `#${type}Long`;
			for(let y in data) {
				const len = data[y];
				this._setLastPlayTick((+y)+len);

				const id = `${type}${lane}_${y}`;

				if(len <= 0) {
					const note = this._createUse(shortTypeHref, x, RD(-this.t2p(+y)), id);
					shorts.add(note);
				}else{
					const note = this._createUse(longTypeHref, 0, 0, id);
					note.setAttribute('transform', `translate(${x} ${RD(-this.t2p(+y))}) scale(1 ${this.t2p(len)})`);
					longs.add(note);
				}
			}
		};

		noteData.bt.forEach((btData, lane) => {
			putNotes('bt', btShorts, btLongs, lane, (lane-2)*this.scale.noteWidth, btData);
		});

		noteData.fx.forEach((fxData, lane) => {
			putNotes('fx', fxShorts, fxLongs, lane, (lane-1)*this.scale.noteWidth*2, fxData);
		});
		*/
	}

	_redrawLasers() {
		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		const laserData = noteData.laser;
		if(!laserData) return;

		// this._svgGroups.lasers.clear();
		laserData.forEach((dict, ind) => {
			const hue = [this.color.hueLaserLeft, this.color.hueLaserRight][ind];
			for(let y in dict){
				const id = `laser${ind}_${y}`;
				this._createLaserPath(id, hue, +y, dict[y]);
			}
		});
	}

	_createLaserPath(id, hue, init, graph) {
		if(!('v' in graph) || !graph.v.length) return;

		/*
		const WIDE = 'wide' in graph ? graph.wide : 1;
		const LASER_POS_WIDTH = this.scale.laserPosWidth;
		const HALF_LASER = this.scale.noteWidth/2-0.5;
		const path = this._createElem('path');
		path.id = id;
		path.setAttribute('fill', `hsla(${hue},100%,60%,0.4)`);
		path.setAttribute('stroke', `hsl(${hue},100%,70%,0.4)`);

		const X = (v) => WIDE*(v-0.5)*LASER_POS_WIDTH;
		const Y = (ry) => RD(-this.t2p(ry+init)-0.5);

		const rightSide = [], leftSide = [];
		graph.v.forEach((gp, ind) => {
			const x = X(gp.v);
			const y = Y(gp.ry);
			if(ind === 0){
				rightSide.push(`M${x+HALF_LASER} ${y}`);
			}else{
				rightSide.push(`L${x+HALF_LASER} ${y}`);
			}
			leftSide.push(`L${x-HALF_LASER} ${y}`);
			if('vf' in gp){
				const xx = X(gp.vf);
				if(xx > x){
					rightSide.push(`h${xx-x}v${-this.scale.laserSlamHeight}`);
					leftSide.push(`L${xx-HALF_LASER} ${y-this.scale.laserSlamHeight}h${x-xx}`);
				}else{
					rightSide.push(`v${-this.scale.laserSlamHeight}h${xx-x}`);
					leftSide.push(`L${xx-HALF_LASER} ${y-this.scale.laserSlamHeight}V${y}`);
				}
			}
		});

		const pathCommands = rightSide;
		if('vf' in graph.v[graph.v.length-1]){
			pathCommands.push(`l${-HALF_LASER} ${-HALF_LASER*2}`);
		}
		for(let i=leftSide.length; i-->0;){
			pathCommands.push(leftSide[i]);
		}

		pathCommands.push('Z');
		path.setAttribute('d', pathCommands.join(''));
		// TODO: draw a header.

		this._svgGroups.lasers.add(path);
		*/
	}

	_redrawMeasures() {
		/*
		const measureLines = this._svgGroups.measureLines.clear();
		const measureProps = this._svgGroups.measureProps.clear();

		const measureLineDef = this._svgDefs.measureLine;
		const beatLineDef = this._svgDefs.beatLine;

		// Let's draw the very first line.
		measureLines.use(measureLineDef);

		if(!this.editor.chartData) return;

		const beatInfo = this.editor.chartData.beat;
		if(!beatInfo || !beatInfo.time_sig) return;

		const lastTick = this._getLastTick();

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
			// Round the y-coordinates to display lines without blurring.
			if(measureIndex > 0) {
				measureLines.use(measureLineDef).y(RD(-this.t2p(measureTick)));
			}

			for(let i=1; i<currTimeSig.v.n; ++i) {
				measureLines.use(beatLineDef).y(RD(-this.t2p(measureTick + i*(this.tickUnit / currTimeSig.v.d))));
			}

			++measureIndex;
			measureTick += currMeasureLength;
		}
		*/
	}

	_redrawEditorUI() {
		this._redrawCursor();
	}

	_redrawCursor() {
		/*
		this._svgGroups.cursorLow.attr('y', RD(-this.t2p(this.cursorLowLoc)));
		this._svgGroups.cursorHigh.attr('y', RD(-this.t2p(this.cursorHighLoc)));
		*/
	}

	/// Update the size of the SVG, but do not redraw everything.
	resize() {
		this._requestAnimationFrame(this._resize, CHARTV_RENDER_PRIORITY.RESIZE);
	}

	_resize() {
		this._height = this.elem.clientHeight;
		this._baseLines.svg.setAttribute('width', this.scale.fullWidth);
		this._baseLines.svg.setAttribute('height', this._height);
		this._baseLines.svg.setAttribute('viewBox', `${this.scale.viewBoxLeft} 0 ${this.scale.fullWidth} ${this._height}`);
		this.elem.style.width = `${this.scale.elemWidth}px`;

		this._updateLocation();
		this._updateNoteWidth();
		this._updateColumnCopies();
	}
	_updateNoteWidth() {
		if(this._prevNoteWidth === this.scale.noteWidth) return;
		this._prevNoteWidth = this.scale.noteWidth;

		this._baseLines.lines.forEach(([i, line]) => {
			line.setAttribute('x', i*this.scale.noteWidth);
		});

		// this._createDefs();
	}
	_updateColumnCopies() {
		if(this._baseLines.copiesArr.length+1 != this.scale.columns){
			this._baseLines.copiesArr.forEach((elem) => elem.remove());
			this._baseLines.copiesArr = [];

			for(let i=1; i<this.scale.columns; ++i){
				const copy = this._createElem(this._baseLines.copies, 'use');
				copy.setAttribute('href', "#baseLines");
				this._baseLines.copiesArr.push(copy);
			}
		}

		for(let i=1; i<this.scale.columns; ++i){
			this._baseLines.copiesArr[i-1].setAttribute('x', this.scale.columnOffset*i);
		}
	}

	/// Helper function for creating baselines
	_createBaseLines() {
		const defs = this._createElem(this._baseLines.svg, 'defs');
		const baseLinesDef = this._createElem(defs, 'g');
		baseLinesDef.id = 'baseLines';
		const masterBaseLine = this._baseLines.master = this._createElem(baseLinesDef, 'line');
		masterBaseLine.id = 'masterBaseLine';
		masterBaseLine.setAttribute('x1', 0);
		masterBaseLine.setAttribute('y1', 0);
		masterBaseLine.setAttribute('x2', 0);
		masterBaseLine.setAttribute('y2', 100); // will be adjusted on resize
		masterBaseLine.setAttribute('stroke', this.color.baseLines);
		masterBaseLine.setAttribute('stroke-width', 1);

		for(let i=-2; i<=2; ++i) {
			if(i === 0) continue;
			const line = this._createElem(baseLinesDef, 'use');
			line.setAttribute('href', "#masterBaseLine");
			line.setAttribute('x', i*this.scale.noteWidth);
			this._baseLines.lines.push([i, line]);
		}

		this._baseLines.elem = this._createElem(this._baseLines.svg, 'use');
		this._baseLines.elem.setAttribute('href', "#baseLines");
		this._baseLines.copies = this._createElem(this._baseLines.svg, 'g');
		this._baseLines.copies.id = 'baseLineCopies';
	}

	startScroll(event) {
		this._scrolling = true;
		this._scrollInitMouseY = event.pageY;
		this._scrollInitTickLoc = this.tickLoc;
		this.scrollBar.classList.add('drag');
	}
	onMouseDown(event) {
		if(this.svg.node.contains(event.target) || this.svgBaseLines.node.contains(event.target)){
			this.setCursorWithMouse(event.offsetX, event.offsetY);
		}
	}
	onMouseMove(event) {
		if(event.which === 0) return;
		if(this._scrolling){
			this.updateLocationFromScrollBar(event.pageY);
			return;
		}
	}
	onMouseUp(event) {
		if(this._scrolling){
			this._scrolling = false;
			this.scrollBar.classList.remove('drag');
			this.updateLocationFromScrollBar(event.pageY);
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

		const effectivePos = y-column*this._height;
		return -this.p2t(this.getTopPixel()+effectivePos);
	}
	updateLocationFromScrollBar(y) {
		const lastTick = this._getLastTick();
		const dy = this._scrollInitMouseY - y;
		const dt = dy * this._scrollTickPerPixel;
		let newTick = RD(this._scrollInitTickLoc + dt);
		newTick = CLIP(newTick, 0, lastTick);
		this.setLocation(newTick);
	}

	_updateLocation() {
		// this.svg.viewbox(this.scale.viewBoxLeft, this._getViewBoxTop(), this.scale.fullWidth, this._height);
		this._updateBaseLines();
		this._updateScrollBar();
	}
	_updateBaseLines() {
		if(this._baseLines.currHeight != this._height){
			this._baseLines.currHeight = this._height;
			this._baseLines.master.setAttribute('y2', this._height);
		}

		let bottomOffset = this.scale.marginBottom - this.t2p(this.tickLoc);
		if(bottomOffset < 0) bottomOffset = 0;
		if(this._baseLines.bottomOffset != bottomOffset){
			this._baseLines.bottomOffset = bottomOffset;
			this._baseLines.elem.setAttribute('y', -bottomOffset);
		}
	}
	_updateScrollBar() {
		const lastTick = this._getLastTick();
		if(lastTick === 0) {
			this.scrollBar.style.display = 'none';
			return;
		}

		this.scrollBar.style.display = 'block';
		this.scrollBar.style.width = `${this.scale.scrollBarWidth}px`;

		// Scale the scroll bar so that...
		// 1. it is roughly proportional to how much the chart is visible
		// 2. it's between 0.05H and 0.9H
		const visibleTicks = this.p2t(this._height*this.scale.columns - this.scale.marginBottom) / lastTick;
		const scrollBarHeight = RD(this._height*CLIP(visibleTicks, 0.05, 0.9));

		const scrollBarTop = (this._height - scrollBarHeight) * (1 - this.tickLoc / lastTick);
		this.scrollBar.style.top = `${scrollBarTop}px`;
		this.scrollBar.style.height = `${scrollBarHeight}px`;

		this._scrollTickPerPixel = lastTick/(this._height - scrollBarHeight);
	}

	_requestAnimationFrame(func, priority) {
		if(priority < this._currRenderPriority) return;

		const triggerAnimationFrame = (this._currRender.length == 0);

		if(priority == this._currRenderPriority && priority < CHARTV_RENDER_PRIORITY.RESIZE) {
			this._currRender.push(func.bind(this));
		}
		else {
			this._currRender = [func.bind(this)];
			this._currRenderPriority = priority;
		}

		if(triggerAnimationFrame) {
			window.requestAnimationFrame(this._onAnimationFrame.bind(this));
		}
	}
	_onAnimationFrame() {
		this._currRender.forEach((f) => f());
		this._currRender = [];
		this._currRenderPriority = CHARTV_RENDER_PRIORITY.NONE;
	}
	_setLastPlayTick(lastPlayTick) {
		if(this.lastPlayTick < lastPlayTick)
			this.lastPlayTick = lastPlayTick;
	}

	/// Computes the last tick of anything.
	_getLastTick() {
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
	_createElem(parent, tag) {
		const elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
		parent.appendChild(elem);

		return elem;
	}
}