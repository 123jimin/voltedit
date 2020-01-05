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

		this.view = new VChartView(this);
		this.toolbar = new VToolbar(this);

		this._dropFileIndicator = elem.querySelector('.drop-file-indicator');
		this._dropFileIndicatorShown = false;
		this._addEventListeners();
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
			console.time("parse chart");
			const chartData = VChartData.create(fileContents[0]);
			console.timeEnd("parse chart");

			if(chartData === null) {
				alert(L10N.t('error-reading-chart-data'));
				return;
			}

			this.chartData = chartData;
			this.view.setLocation(0);
			this.view.redraw();
		}).catch((err) => {
			console.error(err);
		});
	}
	setFileName(fileName) {
	}

	/* Saving Files */
	showSaveFileDialog() {
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
