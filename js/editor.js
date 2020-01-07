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

		this.view = new VChartView(this);
		this.toolbar = new VToolbar(this);

		this._dropFileIndicator = elem.querySelector('.drop-file-indicator');
		this._dropFileIndicatorShown = false;
		this._addEventListeners();
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
			for(let elem of this.elem.querySelectorAll(".toolbar .toolbar-edit-snap")){
				elem.value = this._editSnapBeat;
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

	onResize() {
		this.view.resize();
	}

	/* Drag Events */
	onDragEnter(event) {
		event.preventDefault();

		if(event.dataTransfer.types.includes("Files")) {
			this._showDropFileIndicator();
		}
	}
	onDragOver(event) {
		event.preventDefault();
	}
	onDragLeave(event) {
		event.preventDefault();

		if(event.fromElement === null) {
			this._hideDropFileIndicator();
		}
	}
	onDrop(event) {
		event.preventDefault();
		this._hideDropFileIndicator();

		const files = event.dataTransfer.files;
		if(files.length == 0) return;

		this.openFileList(files);
	}

	/* Opening Files */
	showOpenFileDialog() {
		const fileInput = document.createElement('input');
		fileInput.setAttribute('type', 'file');
		fileInput.setAttribute('accept', ".ksh, .kson");
		fileInput.addEventListener('change', (event) => {
			this.openFileList(fileInput.files);
			fileInput.remove();
		});
		fileInput.click();
	}
	openFileList(files) {
		// TODO: support uploading multiple files (e.g. kson + mp3)
		if(files.length != 1) return;

		readFileList(files).then((fileContents) => {
			console.time("Parsing");
			const chartData = VChartData.create(fileContents[0]);
			console.timeEnd("Parsing");

			if(chartData === null) {
				alert(L10N.t('error-reading-chart-data'));
				return;
			}

			this.setChartData(chartData);
			this.view.setLocation(0);
			this.view.redraw();
		}).catch((err) => {
			console.error(err);
		});
	}
	setChartData(chartData) {
		if(chartData) this.chartData = chartData;
		if(!this.chartData) return;

		const trimmedChartName = this.chartData.meta.title.trim();
		const chartDifficulty = ['NOV','ADV','EXH','INF'][this.chartData.meta.difficulty.idx];

		this.setChartTitle(`${trimmedChartName} [${chartDifficulty}]`);
		this.updateEditSnap();
	}
	setChartTitle(title) {
		if(title === ""){
			document.title = "VOLTEdit";
		}else{
			document.title = `${title} - VOLTEdit`;
		}
	}

	/* Saving Files */
	saveToKSON() {
		if(!this.chartData) return;
		this.saveFile(this.chartData.toKSON(), "chart.kson");
	}
	saveToKSH() {
		if(!this.chartData) return;
	}
	saveFile(text, fileName) {
		const blob = new Blob([text], {'type': "text/plain"});

		const elem = document.createElement('a');
		elem.setAttribute('href', window.URL.createObjectURL(blob));
		elem.setAttribute('download', fileName);
		elem.style.display = 'none';

		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);

		window.URL.revokeObjectURL(blob);
	}

	_addEventListeners() {
		window.addEventListener('resize', this.onResize.bind(this));

		this.elem.addEventListener('dragenter', this.onDragEnter.bind(this), false);
		this.elem.addEventListener('dragover', this.onDragOver.bind(this), false);
		this.elem.addEventListener('dragleave', this.onDragLeave.bind(this), false);
		document.addEventListener('drop', this.onDrop.bind(this), false);
	}
	_showDropFileIndicator() {
		if(this._dropFileIndicatorShown) return;

		this._dropFileIndicatorShown = true;
		this._dropFileIndicator.classList.add('active');
	}
	_hideDropFileIndicator() {
		if(!this._dropFileIndicatorShown) return;

		this._dropFileIndicatorShown = false;
		this._dropFileIndicator.classList.remove('active');
	}
}
