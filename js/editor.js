/// A main editor class
class VEditor {
	constructor(elem) {
		this.elem = elem;
		this.chartData = null;

		this.settings = new VSettings();
		L10N.l(this.settings.get('ui:language'));

		this.editSnapBeat = 16; /// unit: 4th, 8th, 12th, ... beat (not tick)
		this.editSnapTick = 1; /// unit: tick

		this.laserSnap = 10; /// Edit by 1/laserSnap

		this.view = new VView(this);
		this.toolbar = new VToolbar(this);
		this.taskManager = new VTaskManager(this);
		this.keyManager = new VKeyManager(this);
		this.fileManager = new VFileManager(this);

		this.context = null;
		this.setContext(new VEditChartContext(this));

		this.insertMode = false;
		this.setInsertMode(false);

		this.messages = [];

		this._addEventListeners();

		this._onReady();
	}

	doOp(op) {
		this.keyManager.doOp(op);
	}

	getTicksPerWholeNote() {
		if(!this.chartData) return 0;
		return ((this.chartData.beat && this.chartData.beat.resolution) || 240)*4;
	}
	setContext(context) {
		if(this.context && this.context.contextId === context.contextId) return;
		if(this.context) this.context.invalidateSelections();
		this.context = context;

		for(let elem of this.elem.querySelectorAll(".toolbar table.toolbar-edit-contexts button[class^='btn-toolbar-context-']")){
			elem.classList.remove('selected');
		}
		for(let elem of this.elem.querySelectorAll(`.toolbar table.toolbar-edit-contexts button.btn-toolbar-context-${context.contextId}`)){
			elem.classList.add('selected');
		}

		this.view.hideDrawing();
	}
	setInsertMode(insertMode) {
		this.insertMode = insertMode;
		for(let elem of this.elem.querySelectorAll('.btn-toolbar-toggle-insert')) {
			if(insertMode) elem.classList.add('selected');
			else elem.classList.remove('selected');
		}

		this.view.hideDrawing();
	}
	setEditSnap(snap) {
		const oldSnapBeat = this.editSnapBeat;
		this._setEditSnap(snap);
		const resolution = this.getTicksPerWholeNote();
		if(resolution && resolution%this.editSnapBeat === 0)
			this.editSnapTick = resolution/this.editSnapBeat;
		else
			this.editSnapTick = 1;

		if(oldSnapBeat !== this.editSnapBeat || this.editSnapBeat !== snap){
			let postfix = 'th';
			if(this.editSnapBeat % 10 < 4 && this.editSnapBeat % 10 > 0 && (this.editSnapBeat < 10 || this.editSnapBeat > 20)){
				postfix = ['', 'st', 'nd', 'rd'][this.editSnapBeat % 10];
			}
			for(let elem of this.elem.querySelectorAll(".toolbar span.toolbar-edit-tick-disp .beat")){
				elem.innerText = `${this.editSnapBeat}`;
			}
			for(let elem of this.elem.querySelectorAll(".toolbar span.toolbar-edit-tick-disp .ord")){
				elem.innerText = postfix;
			}
		}
	}
	_setEditSnap(snap) {
		if(!this.chartData){
			this.editSnapBeat = CLIP(Math.round(snap), 1, 64);
			return;
		}
		if(snap>0 && isFinite(snap) && snap === 0|snap && this.chartData){
			const resolution = this.getTicksPerWholeNote();
			const dir = snap < this.editSnapBeat ? -1 : +1;
			if(snap > resolution) snap = resolution;
			if(resolution % snap === 0){
				this.editSnapBeat = snap;
				return;
			}
			for(let i=snap-dir; i!=this.editSnapBeat; i-=dir) if(resolution%i === 0){
				this.editSnapBeat = i;
				return;
			}
			for(let i=snap+dir; i>0 && i<=resolution; i+=dir) if(resolution%i === 0){
				this.editSnapBeat = i;
				return;
			}
		}
	}
	updateEditSnap() {
		this.setEditSnap(this.editSnapBeat);
	}
	moveCursor(dir) {
		if(this.context.hasSelection()){
			this.context.moveSelectionByTick(dir*this.editSnapTick);
			return;
		}
		this.view.setCursor(ALIGN_STEP(this.editSnapTick, this.view.cursorStartLoc, dir));
	}
	resizeSelected(dir) {
		if(this.context.hasSelection()){
			this.context.resizeSelectionByTick(dir*this.editSnapTick);
		}
	}

	/* Editing File */
	undo() {
		this.context.invalidateSelections();
		this.taskManager.undo();
	}
	redo() {
		this.context.invalidateSelections();
		this.taskManager.redo();
	}
	addNote(type, index) {
		if(!this.chartData) return;

		const noteData = this.chartData.getNoteData(type, index);
		if(!noteData) return;

		const note = noteData.get(this.view.cursorStartLoc);
		if(note){
			this.context.addToSelection(note.data);
		}else{
			this.context.clearSelection();
			this.taskManager.do(`task-add-${type}`, new VNoteAddTask(this, type, index, this.view.cursorStartLoc, 0));
		}
	}

	createNewChart() {
		this.setChartData(new VChartData());
	}
	setChartData(chartData) {
		if(chartData) this.chartData = chartData;

		this.taskManager.clear();

		this.setWindowTitleFromChartData();

		this.toolbar.setValue('toolbar-song-title', chartData.meta.title || "");
		this.toolbar.setValue('toolbar-song-subtitle', chartData.meta.subtitle || "");
		this.toolbar.setValue('toolbar-charter', chartData.meta.chart_author || "");
		this.toolbar.setValue('toolbar-artist', chartData.meta.artist || "");
		this.toolbar.setValue('toolbar-jacket-author', chartData.meta.jacket_author || "");

		this.toolbar.setValue('toolbar-difficulty', chartData.meta.difficulty && chartData.meta.difficulty.idx || 0);
		this.toolbar.setValue('toolbar-level', chartData.meta.level || 1);

		this.toolbar.setValue('toolbar-difficulty-name', chartData.meta.difficulty && chartData.meta.difficulty.name || "");
		this.toolbar.setValue('toolbar-difficulty-short-name', chartData.meta.difficulty && chartData.meta.difficulty.short_name || "");
		this.toolbar.setValue('toolbar-gauge-total', chartData.gauge && chartData.gauge.total || "");

		this.toolbar.setValue('toolbar-music-path', chartData.audio && chartData.audio.bgm && chartData.audio.bgm.filename || "");
		this.toolbar.setValue('toolbar-jacket-path', chartData.meta && chartData.meta.jacket_filename || "");

		this.updateEditSnap();

		this.view.setLocation(0);
		this.view.redraw();
	}
	setWindowTitleFromChartData() {
		if(!this.chartData){
			document.title = 'VOLTEdit';
			return;
		}

		let trimmedChartName = this.chartData.meta.title.trim();
		if(!trimmedChartName) trimmedChartName = L10N.t('untitled');

		let chartDifficulty = ['NOV','ADV','EXH','VVD','MXM'][this.chartData.meta.difficulty.idx];
		if('short_name' in this.chartData.meta.difficulty) chartDifficulty = this.chartData.meta.difficulty.short_name.trim();

		let chartLevel = this.chartData.meta.level;

		document.title = `${trimmedChartName} [${chartDifficulty} ${chartLevel}] - VOLTEdit`;
	}

	_setMeta(className, fieldName, value) {
		if(!this.chartData || this.chartData.meta[fieldName] === value) return;
		this.chartData.meta[fieldName] = value;
		this.toolbar.setValue(className, value);
	}
	setSongTitle(title) {
		this._setMeta('toolbar-song-title', 'title', title);
		this.setWindowTitleFromChartData();
	}
	setSongSubtitle(subtitle) {
		this._setMeta('toolbar-song-subtitle', 'subtitle', subtitle);
	}
	setCharter(charter) {
		this._setMeta('toolbar-charter', 'chart_author', charter);
	}
	setArtist(artist) {
		this._setMeta('toolbar-artist', 'artist', artist);
	}
	setJacketAuthor(jacketAuthor) {
		this._setMeta('toolbar-jacket-author', 'jacket_author', jacketAuthor);
	}
	setChartDifficulty(difficulty) {
		if(!this.chartData) return;
		if(this.chartData.meta.difficulty && this.chartData.meta.difficulty.idx === +difficulty) return;
		if(!this.chartData.meta.difficulty) this.chartData.meta.difficulty = {};
		this.chartData.meta.difficulty.idx = +difficulty;
		this.toolbar.setValue('toolbar-difficulty', difficulty);

		this.setWindowTitleFromChartData();
	}
	setChartDifficultyName(name) {
		if(!this.chartData) return;
		if(this.chartData.meta.difficulty && this.chartData.meta.difficulty.name === name) return;
		if(!this.chartData.meta.difficulty) this.chartData.meta.difficulty = {};
		if(name.trim()){
			this.chartData.meta.difficulty.name = name;
		}else{
			delete this.chartData.meta.difficulty.name;
		}
		this.toolbar.setValue('toolbar-difficulty-name', name);
	}
	setChartDifficultyShortName(shortName) {
		if(!this.chartData) return;
		if(this.chartData.meta.difficulty && this.chartData.meta.difficulty.short_name === shortName) return;
		if(!this.chartData.meta.difficulty) this.chartData.meta.difficulty = {};
		if(shortName.trim()){
			this.chartData.meta.difficulty.short_name = shortName;
		}else{
			delete this.chartData.meta.difficulty.short_name;
		}
		this.toolbar.setValue('toolbar-difficulty-short-name', shortName);

		this.setWindowTitleFromChartData();
	}
	setChartLevel(level) {
		this._setMeta('toolbar-level', 'level', +level);
		this.setWindowTitleFromChartData();
	}
	setGaugeTotal(total) {
		if(!this.chartData) return;
		if(this.chartData.gauge && this.chartData.gauge.total === total) return;
		if(!this.chartData.gauge) this.chartData.gauge = {};
		if(total >= 100){
			this.chartData.gauge.total = total;
		}else{
			delete this.chartData.gauge.total;
		}
		this.toolbar.setValue('toolbar-gauge-total', total);
	}

	setMusicPath(path) {
		if(!this.chartData) return;
		if(this.chartData.audio && this.chartData.audio.bgm && this.chartData.audio.bgm.filename === path) return;
		if(!this.chartData.audio) this.chartData.audio = {};
		if(!this.chartData.audio.bgm) this.chartData.audio.bgm = {};
		if(path.trim()){
			this.chartData.audio.bgm.filename = path;
		}else{
			delete this.chartData.audio.bgm.filename;
		}
		this.toolbar.setValue('toolbar-music-path', path);
	}
	setJacketPath(path) {
		this._setMeta('toolbar-jacket-path', 'jacket_filename', path);
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

		if(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length === 1){
			this.fileManager.openChartFile([null, event.dataTransfer.files[0]]);
			return;
		}
	}

	/* Message (let's use browser defaults for now) */
	msg(messageObject) {
		this.messages.push(messageObject);
	}
	alert(message) {
		this.msg(new VAlertMessage(this, message));
	}
	async prompt(message, defalutValue) {
		return new Promise((resolve, reject) => {
			setTimeout(() => resolve(prompt(message, defalutValue)), 0);
		});
	}
	async confirm(message) {
		return new Promise((resolve, reject) => {
			setTimeout(() => resolve(confirm(message)), 0);
		});
	}
	error(err) {
		if(err instanceof Error){
			err.message && this.alert(err.message);
			console.error(err, err.stack);
		}else{
			this.alert(err);
			console.error(err);
		}
	}
	warn(message) {
		this.msg(new VWarnMessage(this, message));
		console.warn(message);
	}
	info(message) {
		this.msg(new VInfoMessage(this, message));
	}

	/* Misc */
	onResize() {
		this.view.resize();
	}
	_onReady() {
		document.body.classList.remove('loading');

		this.createNewChart();
	}
	_addEventListeners() {
		window.addEventListener('resize', this.onResize.bind(this));
		window.addEventListener('error', this.error.bind(this));

		this.elem.addEventListener('dragenter', this.onDragEnter.bind(this), false);
		this.elem.addEventListener('dragover', this.onDragOver.bind(this), false);
		this.elem.addEventListener('dragleave', this.onDragLeave.bind(this), false);
		document.addEventListener('drop', this.onDrop.bind(this), false);
	}
}
