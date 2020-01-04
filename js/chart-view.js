// Let's fix the scales for now.
// This will be changed to something users can configure.
const CHARTV = Object.freeze((() => {
	const NOTE_WIDTH =  9; // Width for a single note (and laser)
	const MARGIN_SIDE = 15; // Left and right margins for the chart
	const MARGIN_BOTTOM = 40; // Bottom margin for the chart
	const WHOLE_NOTE = NOTE_WIDTH*20; // Length for a measure
	const FULL_WIDTH = NOTE_WIDTH*11 + MARGIN_SIDE*2; // Width of the view
	const HALF_WIDTH = FULL_WIDTH/2;
	const LASER_LEFT = -2.5 * NOTE_WIDTH;
	const LASER_RIGHT = +2.5 * NOTE_WIDTH;

	return ({
		NOTE_WIDTH, WHOLE_NOTE,
		MARGIN_SIDE, MARGIN_BOTTOM,
		FULL_WIDTH, HALF_WIDTH,
		LASER_LEFT, LASER_RIGHT
	});
})());

const CHARTV_RENDER_PRIORITY = Object.freeze({
	'NONE': 0,
	'MINOR': 1,
	'RESIZE': 2,
	'REDRAW': 3
});

/// Single column view of the chart
class VChartView {
	constructor(editor) {
		this.editor = editor;
		this.elem = editor.elem.querySelector(".chart");
		this.elem.style.width = `${CHARTV.FULL_WIDTH}px`;

		this.svg = SVG().addTo(this.elem).size(CHARTV.FULL_WIDTH, '100%');
		this.tickLoc = 0; /// Current location (in ticks)
		this.tickUnit = 240*4; /// Ticks per *whole* note

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

		this._redrawNotes();

		// Draw AFTER other elements are drawn.
		this._redrawMeasureLines();
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

				if(len <= 0) {
					note = shorts.use(shortDef).move(x, -this.t2p(+y));
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

	_redrawMeasureLines() {
		const measureLines = this._svgGroups.measureLines.clear();
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

	_getViewBoxTop() {
		return CHARTV.MARGIN_BOTTOM-this.t2p(this.tickLoc)-this._height;
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
		const svgDefs = this.svg.defs();
		const defs = this._svgDefs = {};

		const SHORT_BT_HEIGHT = 3;
		const SHORT_FX_HEIGHT = 4;

		// btShort
		{
			const btShort = defs.btShort = svgDefs.rect(CHARTV.NOTE_WIDTH, SHORT_BT_HEIGHT-1);
			btShort.id('btShort');
			btShort.fill('#FFF').stroke({'color': '#AAA', 'width': 1});
		}

		// fxShort
		{
			const fxShort = defs.fxShort = svgDefs.rect(CHARTV.NOTE_WIDTH*2, SHORT_FX_HEIGHT-1);
			fxShort.id('fxShort');
			fxShort.fill('#F90').stroke({'color': '#A40', 'width': 1});
		}

		// btLong
		{
			const btLong = defs.btLong = svgDefs.rect(CHARTV.NOTE_WIDTH-2, 1);
			btLong.id('btLong');
			btLong.fill('#FFF');
		}

		// fxLong
		{
			const fxLong = defs.fxLong = svgDefs.rect(CHARTV.NOTE_WIDTH*2, 1);
			fxLong.id('fxLong');
			fxLong.fill('#DA0');
		}
	}
}
