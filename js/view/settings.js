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
		this.laserFloat = 5;

		this.cursorWidthRatio = 1.5;
		this.tickPropFontSize = 12;

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

		this.columnLeft = -5.5*this.noteWidth;
		this.columnRight = +5.5*this.noteWidth;
		this.columnWidth = 11*this.noteWidth;

		this.viewBoxLeft = this.columnLeft-this.marginSide;

		this.laserPosWidth = 5*this.noteWidth;
		this.laserSlamHeight = CLIP(this.laserSlamRatio*this.noteWidth-2, 0, this.noteWidth);

		this.laneWidth = 4*this.noteWidth;
		this.laneLeft = -2*this.noteWidth;
		this.laneRight = +2*this.noteWidth;

		this.cursorLeft = this.laneLeft*this.cursorWidthRatio;
		this.cursorRight = this.laneRight*this.cursorWidthRatio;
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

		this.selected = '#FF0';

		this.btFill = '#FFF';
		this.btBorder = '#AAA';
		this.btLong = '#EEE';

		this.fxFill = '#F90';
		this.fxBorder = '#A40';
		this.fxLong = '#B80';

		this.measureLine = '#FF0';
		this.beatLine = '#444';
		this.baseLines = '#555';
		this.cursor = '#F00';

		this.textTimeSig = '#9E4';
		this.textBPM = '#6AF'
	}
}
