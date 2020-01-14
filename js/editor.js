const readFileList = (files) => Promise.all([].map.call(files, (file) => new Promise((resolve, reject) => {
	const reader = new FileReader();
	reader.addEventListener('error', reject);
	reader.addEventListener('load', (event) => {
		resolve(reader.result);
	});

	reader.readAsText(file);
})));

/// A main editor class
class VEditor {
	constructor(elem) {
		this.elem = elem;
		this.chartData = null;

		this.settings = new VSettings();
		L10N.l(this.settings.get('ui:language'));

		this._editSnapBeat = 16; /// unit: 4th, 8th, 12th, ... beat (not tick)
		this._editSnapTick = 1; /// unit: tick

		this.view = new VView(this);
		this.toolbar = new VToolbar(this);
		this.taskManager = new VTaskManager(this);
		this.keyManager = new VKeyManager(this);
		this.fileManager = new VFileManager(this);

		// For testing
		this.context = new VEditNoteContext(this, 'bt');
		// this.context = new VEditChartContext(this);

		this._addEventListeners();

		this._onReady();
	}

	getTicksPerWholeNote() {
		if(!this.chartData) return 0;
		return ((this.chartData.beat && this.chartData.beat.resolution) || 240)*4;
	}

	setEditSnap(snap) {
		const oldSnapBeat = this._editSnapBeat;
		this._setEditSnap(snap);
		const resolution = this.getTicksPerWholeNote();
		if(resolution && resolution%this._editSnapBeat === 0)
			this._editSnapTick = resolution/this._editSnapBeat;
		else
			this._editSnapTick = 1;

		if(oldSnapBeat !== this._editSnapBeat || this._editSnapBeat !== snap){
			let postfix = 'th';
			if(this._editSnapBeat % 10 < 4 && this._editSnapBeat % 10 > 0 && (this._editSnapBeat < 10 || this._editSnapBeat > 20)){
				postfix = ['', 'st', 'nd', 'rd'][this._editSnapBeat % 10];
			}
			for(let elem of this.elem.querySelectorAll(".toolbar span.toolbar-edit-tick-disp .beat")){
				elem.innerText = `${this._editSnapBeat}`;
			}
			for(let elem of this.elem.querySelectorAll(".toolbar span.toolbar-edit-tick-disp .ord")){
				elem.innerText = postfix;
			}
		}
	}
	_setEditSnap(snap) {
		if(!this.chartData){
			this._editSnapBeat = CLIP(Math.round(snap), 1, 64);
			return;
		}
		if(snap>0 && isFinite(snap) && snap === 0|snap && this.chartData){
			const resolution = this.getTicksPerWholeNote();
			const dir = snap < this._editSnapBeat ? -1 : +1;
			if(snap > resolution) snap = resolution;
			if(resolution % snap === 0){
				this._editSnapBeat = snap;
				return;
			}
			for(let i=snap-dir; i!=this._editSnapBeat; i-=dir) if(resolution%i === 0){
				this._editSnapBeat = i;
				return;
			}
			for(let i=snap+dir; i>0 && i<=resolution; i+=dir) if(resolution%i === 0){
				this._editSnapBeat = i;
				return;
			}
		}
	}
	updateEditSnap() {
		this.setEditSnap(this._editSnapBeat);
	}
	moveCursor(dir) {
		this.view.setCursor(ALIGN_STEP(this._editSnapTick, this.view.cursorStartLoc, dir));
	}

	/* Editing File */
	undo() {
		this.taskManager.undo();
	}
	redo() {
		this.taskManager.redo();
	}
	addBt(index) {
		if(!this.chartData) return;
		this.taskManager.do('task-add-bt', new VNoteAddTask(this, 'bt', index, this.view.cursorStartLoc, 0));
	}
	addFx(index) {
		if(!this.chartData) return;
		this.taskManager.do('task-add-fx', new VNoteAddTask(this, 'fx', index, this.view.cursorStartLoc, 0));
	}

	setChartData(chartData) {
		if(chartData) this.chartData = chartData;
		if(!this.chartData) return;

		const trimmedChartName = this.chartData.meta.title.trim();
		const chartDifficulty = ['NOV','ADV','EXH','INF'][this.chartData.meta.difficulty.idx];

		this.setChartTitle(`${trimmedChartName} [${chartDifficulty}]`);
		this.updateEditSnap();

		this.view.setLocation(0);
		this.view.redraw();
	}
	setChartTitle(title) {
		if(title === ""){
			document.title = "VOLTEdit";
		}else{
			document.title = `${title} - VOLTEdit`;
		}
	}

	/* Drag Events */
	onDragEnter(event) {
		event.preventDefault();

		if(event.dataTransfer.types.includes("Files")) {
			this.fileManager.showDropFileIndicator();
		}
	}
	onDragOver(event) {
		event.preventDefault();
	}
	onDragLeave(event) {
		event.preventDefault();

		if(event.fromElement === null) {
			this.fileManager.hideDropFileIndicator();
		}
	}
	onDrop(event) {
		event.preventDefault();
		this.fileManager.hideDropFileIndicator();

		if(this.fileManager.openFileList(event.dataTransfer.files))
			return;
	}

	/* Misc */
	onResize() {
		this.view.resize();
	}
	_onReady() {
		document.body.classList.remove('loading');
	}
	_addEventListeners() {
		window.addEventListener('resize', this.onResize.bind(this));

		this.elem.addEventListener('dragenter', this.onDragEnter.bind(this), false);
		this.elem.addEventListener('dragover', this.onDragOver.bind(this), false);
		this.elem.addEventListener('dragleave', this.onDragLeave.bind(this), false);
		document.addEventListener('drop', this.onDrop.bind(this), false);
	}
}
