// Let's fix the scales for now.
// This will be changed to something users can configure.
const CHARTV = Object.freeze((() => {
	const NOTE_WIDTH =  9; // Width for a single note (and laser)
	const MARGIN_SIDE = 15; // Left and right margins for the chart
	const MARGIN_BOTTOM = 40; // Bottom margin for the chart
	const WHOLE_NOTE = NOTE_WIDTH*8*16; // Length for a measure
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
		this._resize();
		this._updateLocation();

		this._redrawNotes();
	}

	_redrawNotes() {
		const fxLongs = this._svgGroups.fxLongs.clear();
		const btLongs = this._svgGroups.btLongs.clear();
		const fxShorts = this._svgGroups.fxShorts.clear();
		const btShorts = this._svgGroups.btShorts.clear();

		if(!this.editor.chartData) return;

		const noteData = this.editor.chartData.note;
		if(!noteData) return;

		const putNotes = (shorts, longs, shortDef, x, data) => {
			for(let y in data) {
				const len = data[y];

				if(len <= 0) {
					const note = shorts.use(shortDef).move(x, -this.t2p(+y));
					continue;
				}

				// TODO: draw long notes
			}
		};

		noteData.bt.forEach((btData, lane) => {
			putNotes(btShorts, btLongs, this._svgDefs.btShort, (lane-2)*CHARTV.NOTE_WIDTH, btData);
		});

		noteData.fx.forEach((fxData, lane) => {
			putNotes(fxShorts, fxLongs, this._svgDefs.fxShort, (lane-1)*CHARTV.NOTE_WIDTH*2, fxData);
		});
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

		this._masterBaseLine.attr('y2', -FULL_HEIGHT);
	}

	/// Set the location of the region to be shown (tickLoc = bottom)
	setLocation(tickLoc) {
		this.tickLoc = tickLoc;
		this._requestAnimationFrame(this._updateLocation, CHARTV_RENDER_PRIORITY.MINOR);
	}

	_updateLocation() {
		this.svg.viewbox(-CHARTV.FULL_WIDTH/2, this._getViewBoxTop(), CHARTV.FULL_WIDTH, this._height);
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
	
	/// Helper function for creating structures for the SVG.
	_createGroups() {
		const groups = this._svgGroups = {
			// Background
			'baseLines': this.svg.group().addClass('baseLines'),
			'measureLines': this.svg.group().addClass('measureLines'),
			// Notes and lasers
			'notes': this.svg.group().addClass('notes'),
			'lasers': this.svg.group().addClass('lasers'),
			// Editor UI
			'rangeSelection': this.svg.group().addClass('rangeSelection'),
			'cursor': this.svg.group().addClass('cursor'),
		};

		// baseLines
		{
			const masterBaseLine = this._masterBaseLine = groups.baseLines.line(0, CHARTV.MARGIN_BOTTOM, 0, -300);
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

		const SHORT_HEIGHT = 2;

		// btShort
		{
			const btShort = defs.btShort = svgDefs.rect(CHARTV.NOTE_WIDTH, SHORT_HEIGHT);
			btShort.move(0, -SHORT_HEIGHT/2).id('btShort');
			btShort.fill('#FFF').stroke({'color': '#AAA', 'width': 1});
		}

		// fxShort
		{
			const fxShort = defs.fxShort = svgDefs.rect(CHARTV.NOTE_WIDTH*2, SHORT_HEIGHT);
			fxShort.move(0, -SHORT_HEIGHT/2).id('fxShort');
			fxShort.fill('#F90').stroke({'color': '#A40', 'width': 1});
		}
	}
}
