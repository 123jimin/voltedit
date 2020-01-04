// Let's fix the scales for now.
// This will be changed to something users can configure.
const CHARTV = Object.freeze((() => {
	const NOTE_WIDTH =  9; // Width for a single note (and laser)
	const MARGIN_SIDE = 15; // Left and right margins for the chart
	const MARGIN_BOTTOM = 40; // Bottom margin for the chart

	// Following values are computed from above values.
	const WHOLE_NOTE = NOTE_WIDTH*20; // Length for a measure
	const FULL_WIDTH = NOTE_WIDTH*11 + MARGIN_SIDE*2; // Width of the view
	const HALF_WIDTH = FULL_WIDTH/2;
	const LASER_LEFT = -2.5 * NOTE_WIDTH;
	const LASER_RIGHT = +2.5 * NOTE_WIDTH;

	const LANE_WIDTH = 4 * NOTE_WIDTH;
	const LANE_LEFT = -2 * NOTE_WIDTH;
	const LANE_RIGHT = +2 * NOTE_WIDTH;

	return ({
		NOTE_WIDTH, WHOLE_NOTE,
		MARGIN_SIDE, MARGIN_BOTTOM,
		FULL_WIDTH, HALF_WIDTH,
		LASER_LEFT, LASER_RIGHT,
		LANE_WIDTH, LANE_LEFT, LANE_RIGHT
	});
})());

const CHARTV_RENDER_PRIORITY = Object.freeze({
	'NONE': 0,
	'MINOR': 1,
	'RESIZE': 2,
	'REDRAW': 3
});

/// Shorthand for Math.round()
const RD = Math.round;

/// Round to half-int
const RDH = (x) => RD(x+0.5)-0.5;

/// Single column view of the chart
class VChartView {
	constructor(editor) {
		this.editor = editor;
		this.elem = editor.elem.querySelector(".chart");
		this.elem.style.width = `${CHARTV.FULL_WIDTH}px`;

		this.svg = SVG().addTo(this.elem).size(CHARTV.FULL_WIDTH, '100%');
		this.tickLoc = 0; /// Current location (in ticks)
		this.tickUnit = 240*4; /// Ticks per *whole* note
		this.lastPlayTick = 0; /// Last tick of notes/laser

		this.hueLaserLeft = 180;
		this.hueLaserRight = 300;

		this._height = 0;
		this._svgGroups = null;
		this._svgDefs = null;
		this._masterBaseLine = null;
		this._createGroups();
		this._createDefs();

		this._currRender = [];
		this._currRenderPriority = CHARTV_RENDER_PRIORITY.NONE;

		this._redraw();

		this.elem.addEventListener('wheel', this.onWheel.bind(this));
	}

	// Tick to pixel
	t2p(tick) {
		return tick*CHARTV.WHOLE_NOTE/this.tickUnit;
	}

	// Pixel to tick
	p2t(px) {
		return px*this.tickUnit/CHARTV.WHOLE_NOTE;
	}

	redraw() {
		this._requestAnimationFrame(this._redraw, CHARTV_RENDER_PRIORITY.REDRAW);
	}
	
	/// Clear and redraw everything.
	_redraw() {
		this.tickUnit = this._getTickUnitFromChart();

		this._resize();
		this._updateLocation();

		this.lastPlayTick = 0;
		this._redrawNotes();
		this._redrawLasers();

		// Call after notes and lasers are drawn, to use updated lastPlayTick.
		this._redrawMeasures();
	}

	_redrawNotes() {
		const fxLongs = this._svgGroups.fxLongs.clear();
		const btLongs = this._svgGroups.btLongs.clear();
		const fxShorts = this._svgGroups.fxShorts.clear();
		const btShorts = this._svgGroups.btShorts.clear();

		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		const putNotes = (type, shorts, longs, shortDef, longDef, lane, x, data) => {
			for(let y in data) {
				const len = data[y];
				let note = null;

				this._setLastPlayTick((+y)+len);

				if(len <= 0) {
					note = shorts.use(shortDef).move(x, -this.t2p(+y)-2);
				}else{
					note = longs.use(longDef);
					note.transform({'scaleY': this.t2p(len),
						'translateX': x+1, 'translateY': -this.t2p(+y)-this.t2p(len)/2});
				}

				note.id(`${type}-${lane}-${y}`);
			}
		};

		noteData.bt.forEach((btData, lane) => {
			putNotes('bt', btShorts, btLongs, this._svgDefs.btShort, this._svgDefs.btLong,
				lane, (lane-2)*CHARTV.NOTE_WIDTH, btData);
		});

		noteData.fx.forEach((fxData, lane) => {
			putNotes('fx', fxShorts, fxLongs, this._svgDefs.fxShort, this._svgDefs.fxLong,
				lane, (lane-1)*CHARTV.NOTE_WIDTH*2, fxData);
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
	
	/// Update the size of the SVG, but do not redraw everything.
	resize() {
		this._requestAnimationFrame(this._resize, CHARTV_RENDER_PRIORITY.RESIZE);
	}

	_resize() {
		const FULL_HEIGHT = this._updateHeight();
		const VIEW_BOX_TOP = this._getViewBoxTop();
		this.svg.size(CHARTV.FULL_WIDTH, FULL_HEIGHT);
		this.svg.viewbox(-CHARTV.FULL_WIDTH/2, VIEW_BOX_TOP, CHARTV.FULL_WIDTH, FULL_HEIGHT);

		this._updateBaseLines();
	}

	/// Set the location of the region to be shown (tickLoc = bottom)
	setLocation(tickLoc) {
		this.tickLoc = isFinite(tickLoc) ? tickLoc : 0;
		this._requestAnimationFrame(this._updateLocation, CHARTV_RENDER_PRIORITY.MINOR);
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

	_updateLocation() {
		this.svg.viewbox(-CHARTV.FULL_WIDTH/2, this._getViewBoxTop(), CHARTV.FULL_WIDTH, this._height);
		this._updateBaseLines();
	}

	_updateBaseLines() {
		const VIEW_BOX_TOP = this._getViewBoxTop();
		const VIEW_BOX_BOTTOM = VIEW_BOX_TOP + this._height;
		this._masterBaseLine.attr('y1', VIEW_BOX_BOTTOM > 0 ? 0 : VIEW_BOX_BOTTOM);
		this._masterBaseLine.attr('y2', VIEW_BOX_TOP);
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
		return Math.round(CHARTV.MARGIN_BOTTOM-this.t2p(this.tickLoc)-this._height);
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
			const masterBaseLine = this._masterBaseLine = groups.baseLines.line(0, CHARTV.MARGIN_BOTTOM, 0, 0 /* will be adjusted on resize */);
			masterBaseLine.addClass('baseLine').stroke({'color': "hsl(0, 0%, 30%)", 'width': 1});

			for(let i=-2; i<=2; ++i) {
				if(i == 0) continue;
				const line = groups.baseLines.use(masterBaseLine).move(i*CHARTV.NOTE_WIDTH, 0);
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
		
		const SHORT_BT_HEIGHT = 3;
		const SHORT_FX_HEIGHT = 4;
		
		// btShort
		const btShort = defs.btShort = svgDefs.rect(CHARTV.NOTE_WIDTH, SHORT_BT_HEIGHT-1);
		btShort.id('btShort');
		btShort.fill('#FFF').stroke({'color': '#AAA', 'width': 1});

		// fxShort
		const fxShort = defs.fxShort = svgDefs.rect(CHARTV.NOTE_WIDTH*2, SHORT_FX_HEIGHT-1);
		fxShort.id('fxShort');
		fxShort.fill('#F90').stroke({'color': '#A40', 'width': 1});

		// btLong
		const btLong = defs.btLong = svgDefs.rect(CHARTV.NOTE_WIDTH-2, 1);
		btLong.id('btLong');
		btLong.fill('#FFF');

		// fxLong
		const fxLong = defs.fxLong = svgDefs.rect(CHARTV.NOTE_WIDTH*2, 1);
		fxLong.id('fxLong');
		fxLong.fill('#DA0');
	}

	/// Helper function for creating measure lines and cursors
	_createLineDefs() {
		const svgDefs = this.svg.defs();
		const defs = this._svgDefs;

		// measure line
		const measureLine = defs.measureLine = svgDefs.line(CHARTV.LANE_LEFT, -0.5, CHARTV.LANE_RIGHT, -0.5);
		measureLine.id('measureLine');
		measureLine.stroke({'width': 1, 'color': '#FF0'});

		// beat line
		const beatLine = defs.beatLine = svgDefs.line(CHARTV.LANE_LEFT, -0.5, CHARTV.LANE_RIGHT, -0.5);
		beatLine.id('beatLine');
		beatLine.stroke({'width': 1, 'color': '#444'});

		// cursor
	}
}
