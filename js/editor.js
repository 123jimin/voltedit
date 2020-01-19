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
		if(this.context) this.context.clearSelection();
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
		if(this.context.hasSelection()){
			this.context.moveSelectionByTick(dir*this._editSnapTick);
			return;
		}
		this.view.setCursor(ALIGN_STEP(this._editSnapTick, this.view.cursorStartLoc, dir));
	}
	resizeSelected(dir) {
		if(this.context.hasSelection()){
			this.context.resizeSelectionByTick(dir*this._editSnapTick);
		}
	}

	/* Editing File */
	undo() {
		this.taskManager.undo();
	}
	redo() {
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
