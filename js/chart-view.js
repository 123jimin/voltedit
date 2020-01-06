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
		this.noteWidth = settings.get('editor:note:width');
		this.btNoteHeight = 2;
		this.fxNoteHeight = 3;

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

	_computeRests() {
		this.wholeNote = this.noteWidth*this.measureScale;
		this.fullWidth = this.noteWidth*11 + this.marginSide*2;
		this.elemWidth = this.fullWidth + this.scrollBarWidth;

		this.laserLeft = -2.5*this.noteWidth;
		this.laserRight = +2.5*this.noteWidth;

		this.laneWidth = 4*this.noteWidth;
		this.laneLeft = -2*this.noteWidth;
		this.laneRight = +2*this.noteWidth;
	}
}

/// Manager for chart colors
/// TODO: make this work
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

/// Single column view of the chart
class VChartView {
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

		this.svg = SVG().addTo(this.elem).size(this.scale.fullWidth, '100%');
		this.tickUnit = 240*4; /// Ticks per *whole* note

		this.tickLoc = 0; /// Current display location (in ticks)
		this.cursorLoc = 0; /// Current cursor location (in ticks)

		this.lastPlayTick = 0; /// Last tick of notes/laser

		this._prevNoteWidth = this.scale.noteWidth;

		this._height = 0;
		this._svgGroups = null;
		this._svgDefs = null;
		this._masterBaseLine = null;
		this._baseLines = [];
		this._createGroups();
		this._createDefs();

		this._currRender = [];
		this._currRenderPriority = CHARTV_RENDER_PRIORITY.NONE;

		this._redraw();

		this.elem.addEventListener('wheel', this.onWheel.bind(this), {'passive': true});

		this.scrollBar.addEventListener('mousedown', this.startScroll.bind(this));
		document.addEventListener('mousemove', this.onMouseMove.bind(this), {'passive': true});
		document.addEventListener('mouseup', this.onMouseUp.bind(this), {'passive': true});
	}

	/// Tick to pixel
	t2p(tick) {
		return tick*this.scale.wholeNote/this.tickUnit;
	}

	/// Pixel to tick
	p2t(px) {
		return px*this.tickUnit/this.scale.wholeNote;
	}

	/// Set the location of the region to be shown (tickLoc = bottom)
	setLocation(tickLoc) {
		this.tickLoc = isFinite(tickLoc) ? tickLoc : 0;
		this._requestAnimationFrame(this._updateLocation, CHARTV_RENDER_PRIORITY.MINOR);
	}

	setCursor(cursorLoc) {
		this.cursorLoc = isFinite(cursorLoc) && cursorLoc > 0 ? cursorLoc : 0;
		this._requestAnimationFrame(this._redrawCursor, CHARTV_RENDER_PRIORITY.MINOR);
	}

	redraw() {
		this._requestAnimationFrame(this._redraw, CHARTV_RENDER_PRIORITY.REDRAW);
	}

	/// Clear and redraw everything.
	_redraw() {
		this.tickUnit = this._getTickUnitFromChart();

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
		const fxLongs = this._svgGroups.fxLongs.clear();
		const btLongs = this._svgGroups.btLongs.clear();
		const fxShorts = this._svgGroups.fxShorts.clear();
		const btShorts = this._svgGroups.btShorts.clear();

		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		const putNotes = (type, shorts, longs, lane, x, data) => {
			const shortTypeHref = `#${type}Short`;
			const longTypeHref = `#${type}Long`;
			for(let y in data) {
				const len = data[y];
				this._setLastPlayTick((+y)+len);

				const id = `${type}-${lane}-${y}`;

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
	}

	_redrawLasers() {
		// TODO: impl
	}

	_redrawMeasures() {
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
	}

	_redrawEditorUI() {
		this._redrawCursor();
	}

	_redrawCursor() {
		this._svgGroups.cursor.attr('y', RD(-this.t2p(this.cursorLoc)));
	}

	/// Update the size of the SVG, but do not redraw everything.
	resize() {
		this._requestAnimationFrame(this._resize, CHARTV_RENDER_PRIORITY.RESIZE);
	}

	_resize() {
		this.svg.size(this.scale.fullWidth, this._updateHeight());

		this._updateLocation();
		this._updateNoteWidth();
	}

	_updateNoteWidth() {
		if(this._prevNoteWidth === this.scale.noteWidth) return;
		this._prevNoteWidth = this.scale.noteWidth;

		this._baseLines.forEach(([i, line]) => {
			line.x(i*this.scale.noteWidth);
		});

		// TODO: set other things properly (e.g. measure line, note defs)
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
	startScroll(event) {
		this._scrolling = true;
		this._scrollInitMouseY = event.pageY;
		this._scrollInitTickLoc = this.tickLoc;
		this.scrollBar.classList.add('drag');
	}
	onMouseMove(event) {
		if(this._scrolling){
			this.updateLocationFromScrollBar(event.pageY);
		}
	}
	onMouseUp(event) {
		if(this._scrolling){
			this._scrolling = false;
			this.scrollBar.classList.remove('drag');
			this.updateLocationFromScrollBar(event.pageY);
		}
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
		this.svg.viewbox(-this.scale.fullWidth/2, this._getViewBoxTop(), this.scale.fullWidth, this._height);
		this._updateBaseLines();
		this._updateScrollBar();
	}

	_updateBaseLines() {
		const VIEW_BOX_TOP = this._getViewBoxTop();
		const VIEW_BOX_BOTTOM = VIEW_BOX_TOP + this._height;
		this._masterBaseLine.attr('y1', VIEW_BOX_BOTTOM > 0 ? 0 : VIEW_BOX_BOTTOM);
		this._masterBaseLine.attr('y2', VIEW_BOX_TOP);
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
		const visibleTicks = this.p2t(this._height - this.scale.marginBottom) / lastTick;
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

	_updateHeight() {
		return this._height = this.elem.clientHeight;
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

	_getViewBoxTop() {
		return Math.round(this.scale.marginBottom-this.t2p(this.tickLoc)-this._height);
	}

	_getTickUnitFromChart() {
		const DEFAULT_RESOLUTION = 240;

		if(!this.editor.chartData || !this.editor.chartData.beat) {
			return DEFAULT_RESOLUTION * 4;
		}

		return (this.editor.chartData.beat.resolution || DEFAULT_RESOLUTION) * 4;
	}

	/// Helper function for creating structures for the SVG.
	_createGroups() {
		const baseLines = this.svg.group().addClass('baseLines').attr('buffered-rendering', 'static');
		// Chart contents which must be moved together
		const chartGroup = this.svg.group().addClass('chartGroup').attr('buffered-rendering', 'static');
		const groups = this._svgGroups = {
			// Background
			'baseLines': baseLines,
			'measureLines': chartGroup.group().addClass('measureLines'),
			'measureProps': chartGroup.group().addClass('measureProps'),
			// Notes and lasers
			'notes': chartGroup.group().addClass('notes'),
			'lasers': chartGroup.group().addClass('lasers'),
			// Editor UI
			'rangeSelection': this.svg.group().addClass('rangeSelection'),
			'cursor': this.svg.group().addClass('cursor').attr('buffered-rendering', 'static'),
		};

		// baseLines
		{
			const masterBaseLine = this._masterBaseLine = groups.baseLines.line(0, this.scale.marginBottom, 0, 0 /* will be adjusted on resize */);
			masterBaseLine.addClass('baseLine').stroke({'color': this.color.baseLines, 'width': 1});

			for(let i=-2; i<=2; ++i) {
				if(i === 0) continue;
				const line = groups.baseLines.use(masterBaseLine).x(i*this.scale.noteWidth);
				this._baseLines.push([i, line]);
			}
		}

		// notes
		// long notes are drawn first
		{
			const notes = groups.notes;

			groups.fxLongs = notes.group().addClass('fxLongs');
			groups.btLongs = notes.group().addClass('btLongs');
			groups.fxShorts = notes.group().addClass('fxShorts');
			groups.btShorts = notes.group().addClass('btShorts');
		}
	}

	/// Helper function for creating various shapes to be used
	_createDefs() {
		this._createNoteDefs();
		this._createLineDefs();
	}

	/// Helper function for creating note defs
	_createNoteDefs() {
		const svgDefs = this.svg.defs();
		const defs = this._svgDefs = {};
		const color = this.color;

		const SHORT_BT_HEIGHT = 3;
		const SHORT_FX_HEIGHT = 4;

		const createRectDef = (id, x, y, w, h, fill, stroke) => {
			const rect = defs[id] = this._createRectPath(x, y, w, h);
			rect.id = id;
			rect.setAttribute('fill', fill);
			if(stroke){
				rect.setAttribute('stroke-width', 1);
				rect.setAttribute('stroke', stroke);
			}
			svgDefs.add(rect);
		};

		createRectDef('btShort', 0, -0.5, this.scale.noteWidth, -this.scale.btNoteHeight, color.btFill, color.btBorder);
		createRectDef('fxShort', 0, -0.5, this.scale.noteWidth*2, -this.scale.fxNoteHeight, color.fxFill, color.fxBorder);
		createRectDef('btLong', 1, 0, this.scale.noteWidth-2, -1, color.btLong);
		createRectDef('fxLong', 0, 0, this.scale.noteWidth*2, -1, color.fxLong);
	}

	/// Helper function for creating measure lines and cursors
	_createLineDefs() {
		const svgDefs = this.svg.defs();
		const defs = this._svgDefs;
		const color = this.color;

		// measure line
		const measureLine = defs.measureLine = svgDefs.line(this.scale.laneLeft, -0.5, this.scale.laneRight, -0.5);
		measureLine.id('measureLine');
		measureLine.stroke({'width': 1, 'color': color.measureLine});

		// beat line
		const beatLine = defs.beatLine = svgDefs.line(this.scale.laneLeft, -0.5, this.scale.laneRight, -0.5);
		beatLine.id('beatLine');
		beatLine.stroke({'width': 1, 'color': color.beatLine});

		// cursor
		const cursor = defs.cursor = svgDefs.line(this.scale.laneLeft*1.5, -0.5, this.scale.laneRight*1.5, -0.5);
		cursor.id('cursor');
		cursor.stroke({'width': 1, 'color': color.cursor});
		this._svgGroups.cursor.use(cursor);
	}

	/// Creates a rectangle path (for svgDef)
	_createRectPath(x, y, w, h) {
		const path = document.createElementNS(this.svg.node.namespaceURI, 'path');
		path.setAttribute('d', `M${x} ${y}h${w}v${h}h${-w}Z`);
		return path;
	}

	_createUse(href, x, y, id) {
		const use = document.createElementNS(this.svg.node.namespaceURI, 'use');
		use.setAttribute('href', href);
		use.setAttribute('x', x);
		use.setAttribute('y', y);
		use.id = id;
		return use;
	}
}
