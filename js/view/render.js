/// Class for displaying draw/move/delete/select... operations given by VView
/// VView will take charge of managing the data, and VViewRender will only receive what to display.
class VViewRender {
	constructor(view) {
		this.view = view;
		this.elem = view.elem.querySelector(".chart-view");

		this.scene = new THREE.Scene();
		this.renderer = new THREE.WebGLRenderer({
			'alpha': true, 'antialias': true,
			// 'precision': 'mediump', 'powerPreference': 'low-power',
		});
		this.renderer.sortObjects = false;
		this.renderer.setClearColor(0, 0);
		this.renderer.setSize(this.view.scale.elemWidth, 100 /* will be adjusted later */);
		this.elem.appendChild(this.renderer.domElement);

		this._initDrawData();

		this.columns = [];
		this._addColumn();
	}

	setCursor(start, end) {
		this.cursorStart.position.y = this.view.t2p(start);
		this.cursorEnd.position.y = this.view.t2p(end);

		if(this.selection.visible = (start !== end)){
			const points = [];
			const scale = this.view.scale;
			RECT(points, [scale.cursorLeft, this.cursorStart.position.y], [scale.cursorRight, this.cursorEnd.position.y]);

			RenderHelper.updateGeometry(this.selection, points);
		}
	}

	/** Drawing measure data **/
	clearMeasures() {
		RenderHelper.clear(this.measureLines);
	}
	addMeasureLine(pos) {
		const measureLine = this.measureLineTemplate.create();
		measureLine.position.set(0, this.view.t2p(pos), 0);

		this.measureLines.add(measureLine);
	}
	addBeatLine(pos) {
		const beatLine = this.beatLineTemplate.create();
		beatLine.position.set(0, this.view.t2p(pos), 0);

		this.measureLines.add(beatLine);
	}

	/** Drawing note data **/
	clearNotes() {
		RenderHelper.clear(this.fxLongs);
		RenderHelper.clear(this.btLongs);
		RenderHelper.clear(this.fxShorts);
		RenderHelper.clear(this.btShorts);

		this.fxNotesByY = [];
		this.btNotesByY = [];
	}
	addBtNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.btShorts, this.btShortTemplate, this.btShortSelectedTemplate, lane, pos);
		} else {
			note = this._addLongNote(this.btLongs, this.view.scale.noteWidth, 1,
				this.view.color.btLong, this.view.color.selected, lane, pos, len);
		}
		while(lane >= this.btNotesByY.length) this.btNotesByY.push({});
		this.btNotesByY[lane][pos] = note;
	}
	addFxNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.fxShorts, this.fxShortTemplate, this.fxShortSelectedTemplate, lane*2, pos);
		} else {
			note = this._addLongNote(this.fxLongs, this.view.scale.noteWidth*2, 0,
				this.view.color.fxLong, this.view.color.selected, lane*2, pos, len);
		}
		while(lane >= this.fxNotesByY.length) this.fxNotesByY.push({});
		this.fxNotesByY[lane][pos] = note;
	}
	_addLongNote(noteCollection, noteWidth, padding, color, selectedColor, lane, pos, len) {
		const [note, noteSelected] = this._addNote(noteCollection,
			this._createLongNoteTemplate(noteWidth, padding, color, len),
			this._createLongNoteTemplate(noteWidth, padding, selectedColor, len),
			lane, pos);

		note.userData._disposeGeometry = true;
		note.userData._disposeMaterial = true;
		noteSelected.userData._disposeGeometry = true;
		noteSelected.userData._disposeMaterial = true;

		return [note, noteSelected];
	}
	_addNote(noteCollection, noteTemplate, noteSelectedTemplate, lane, pos) {
		const scale = this.view.scale;
		const note = noteTemplate.create();
		note.position.set((lane-2)*scale.noteWidth, RD(this.view.t2p(pos)), 0);
		noteCollection.add(note);

		let noteSelected = null;
		if(noteSelectedTemplate){
			noteSelected = noteSelectedTemplate.create();
			noteSelected.visible = false;
			note.add(noteSelected);
		}

		return [note, noteSelected];
	}
	selBtNote(lane, pos, selected) {
		this._selNote(this.btNotesByY, lane, pos, selected);
	}
	selFxNote(lane, pos, selected) {
		this._selNote(this.fxNotesByY, lane, pos, selected);
	}
	_selNote(notesByY, lane, pos, selected) {
		if(lane >= notesByY.length) return;
		if(!(pos in notesByY[lane])) return;
		const [_, noteSelected] = notesByY[lane][pos];
		noteSelected.visible = selected;
	}
	delBtNote(lane, pos) {
		this._delNote(this.btNotesByY, lane, pos);
	}
	delFxNote(lane, pos) {
		this._delNote(this.fxNotesByY, lane, pos);
	}
	_delNote(notesByY, lane, pos){
		const [note, noteSelected] = notesByY[lane][pos];

		RenderHelper.dispose(noteSelected);
		RenderHelper.dispose(note);
		delete notesByY[lane][pos];
	}

	fakeMoveBtNoteTo(lane, pos, newLane, newPos) {
		this._fakeMoveNoteTo(this.btNotesByY[lane], pos, newLane, newPos);
	}
	fakeMoveFxNoteTo(lane, pos, newLane, newPos) {
		this._fakeMoveNoteTo(this.fxNotesByY[lane], pos, newLane*2, newPos);
	}
	_fakeMoveNoteTo(notesByY, pos, newLane, newPos) {
		if(!(pos in notesByY)) return;

		const [note, _] = notesByY[pos];
		note.position.set((newLane-2)*this.view.scale.noteWidth, RD(this.view.t2p(newPos)), 0);
	}

	showBTDrawing(lane, pos) {
		this.btShortDrawing.visible = true;
		if(this.btLongDrawing) this.btLongDrawing.visible = false;
		this.btShortDrawing.position.set((lane-2)*this.view.scale.noteWidth, RD(this.view.t2p(pos)), 0);
	}
	showFXDrawing(lane, pos) {
		this.fxShortDrawing.visible = true;
		if(this.fxLongDrawing) this.fxLongDrawing.visible = false;
		this.fxShortDrawing.position.set((lane-1)*2*this.view.scale.noteWidth, RD(this.view.t2p(pos)), 0);
	}
	showBTLongDrawing(lane, pos, len) {
		this.btShortDrawing.visible = false;
		this.btLongDrawing = this._showLongNoteDrawing(
			this.btLongDrawing, this.view.scale.noteWidth, 1,
			this.view.color.btLong, lane, pos, len
		);
	}
	showFXLongDrawing(lane, pos, len) {
		this.fxShortDrawing.visible = false;
		this.fxLongDrawing = this._showLongNoteDrawing(
			this.fxLongDrawing, this.view.scale.noteWidth*2, 0,
			this.view.color.fxLong, lane*2, pos, len
		);
	}
	_showLongNoteDrawing(obj, noteWidth, padding, color, lane, pos, len) {
		if(obj){
			const points = [];
			RECT(points, [padding, 0], [noteWidth-padding, this.view.t2p(len)]);
			RenderHelper.updateGeometry(obj, points);
		}else{
			const noteTemplate = this._createLongNoteTemplate(noteWidth, padding, color, len);
			obj = noteTemplate.create();
			this.noteDrawings.add(obj);
		}
		obj.position.set((lane-2)*this.view.scale.noteWidth, RD(this.view.t2p(pos)), 0);
		obj.visible = true;
		return obj;
	}
	hideDrawing() {
		this.btShortDrawing.visible = false;
		this.fxShortDrawing.visible = false;
	}

	/** Drawing laser data **/
	clearLasers() {
		RenderHelper.clear(this.lasers);
		this.lasersByY = [];
	}
	addLaser(lane, currNode, nextNode) {
		const laserGraphPoint = new VLaserRenderPoint(this, lane, currNode.y, currNode.data, nextNode, false);
		this.lasers.add(laserGraphPoint.object);

		while(lane >= this.lasersByY.length) this.lasersByY.push({});
		this.lasersByY[lane][currNode.y] = laserGraphPoint;
	}
	selLaserSlam(lane, pos, slam) {
		if(lane >= this.lasersByY.length) return;
		if(!(pos in this.lasersByY[lane])) return;
		this.lasersByY[lane][pos].selSlam(slam);
	}
	selLaserEdge(lane, pos, edge) {
		if(lane >= this.lasersByY.length) return;
		if(!(pos in this.lasersByY[lane])) return;
		this.lasersByY[lane][pos].selEdge(edge);
	}
	selLaserEditPoint(lane, pos, isVF, selected) {
		if(lane >= this.lasersByY.length) return;
		if(!(pos in this.lasersByY[lane])) return;
		this.lasersByY[lane][pos].selEditPoint(isVF, selected);
	}
	delLaser(lane, pos) {
		if(lane >= this.lasersByY.length) return;
		if(!(pos in this.lasersByY[lane])) return;
		this.lasersByY[lane][pos].dispose();
		delete this.lasersByY[lane][pos];
	}
	updateLaser(lane, currNode, nextNode) {
		if(lane >= this.lasersByY.length) return;
		if(!(currNode.y in this.lasersByY[lane])) return;
		this.lasersByY[lane][currNode.y].update(currNode.y, currNode.data, nextNode);
	}

	showLaserDrawing(lane, tick, prevNode, nextNode, point) {
		if(lane >= this.laserDrawingPoints.length) return;
		if(prevNode && !(prevNode.y in this.lasersByY[lane])) return;

		this.laserDrawingPoints[lane].update(tick, point, nextNode);
	}

	/** Drawing tick props **/
	clearTickProps() {
		RenderHelper.clear(this.tickProps);
		this.tickPropsByY = {};
	}
	addBPMChanges(pos, bpm) {
		this._getTickProp(pos).setBPM(bpm);
	}
	addTimeSig(pos, n, d) {
		this._getTickProp(pos).setTimeSig(n, d);
	}
	_getTickProp(pos) {
		if(pos in this.tickPropsByY) return this.tickPropsByY[pos];
		return this.tickPropsByY[pos] = new VTickProp(this, pos);
	}

	/** Resizing **/
	resize() {
		this.renderer.setSize(this.view.scale.fullWidth, this.view.height);

		while(this.columns.length < this.view.scale.columns){
			this._addColumn();
		}

		this.columns.forEach((column) => {
			column.resize();
		});
	}
	updateLocation() {
		this.columns.forEach((column) => {
			column.updateLocation();
		});
	}
	_addColumn() {
		const column = new VViewColumn(this, this.columns.length);
		this.columns.push(column);
	}

	render() {
		for(let y in this.tickPropsByY) {
			this.tickPropsByY[y].redraw();
		}
		this.columns.forEach((column) => column.render());
	}

	/** Initialization of drawing data **/
	_initDrawData() {
		const scale = this.view.scale;
		this.laneCrossingLineGeometry = this._createLineGeometry(
			new THREE.Vector3(scale.laneLeft, 0, 0),
			new THREE.Vector3(scale.laneRight, 0, 0),
		);
		this.cursorLineGeometry = this._createLineGeometry(
			new THREE.Vector3(scale.cursorLeft, 0, 0),
			new THREE.Vector3(scale.cursorRight, 0, 0),
		);
		this.selectedMaterial = new THREE.MeshBasicMaterial({'color': this.view.color.selected});
		// Note that the groups are created in a specific order.
		this._initMeasureDrawData();
		this._initNoteDrawData();
		this._initLaserDrawData();
		this._initTickPropData();
		this._initEditorUIDrawData();
	}

	_initMeasureDrawData() {
		const color = this.view.color;

		this.measureLines = this._createGroup(-1);

		this.measureLineTemplate = new VModelTemplate(THREE.Line,
			this.laneCrossingLineGeometry,
			new THREE.LineBasicMaterial({'color': color.measureLine})
		);
		this.beatLineTemplate = new VModelTemplate(THREE.Line,
			this.laneCrossingLineGeometry,
			new THREE.LineBasicMaterial({'color': color.beatLine})
		);
	}

	_initNoteDrawData() {
		const scale = this.view.scale;
		const color = this.view.color;

		this.fxLongs = this._createGroup(0);
		this.btLongs = this._createGroup(0);
		this.fxShorts = this._createGroup(0);
		this.btShorts = this._createGroup(0);
		this.noteDrawings = this._createGroup(0);

		// [note, noteSelected] = this.btNotesByY[lane][y]
		this.btNotesByY = [];
		this.fxNotesByY = [];

		this.btShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth, scale.btNoteHeight, color.btFill, color.btBorder);
		this.fxShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth*2, scale.fxNoteHeight, color.fxFill, color.fxBorder);

		this.btShortSelectedTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth, scale.btNoteHeight, color.selected);
		this.fxShortSelectedTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth*2, scale.fxNoteHeight, color.selected);

		this.btLongDrawing = null;
		this.fxLongDrawing = null;

		this.btShortDrawing = this.btShortTemplate.create();
		this.btShortDrawing.visible = false;
		this.noteDrawings.add(this.btShortDrawing);

		this.fxShortDrawing = this.fxShortTemplate.create();
		this.fxShortDrawing.visible = false;
		this.noteDrawings.add(this.fxShortDrawing);
	}
	_createLongNoteTemplate(width, padding, color, len) {
		return this._createRectangleTemplate(padding, 0, width-padding*2, this.view.t2p(len), color);
	}

	_initLaserDrawData() {
		const laserZ = CLIP(this.view.scale.laserFloat, 1, VVIEW_EDITOR_UI_Z);
		this.lasers = this._createGroup(laserZ);
		this.laserDrawings = this._createGroup(laserZ);
		this.lasersByY = [];

		this.laserBodyMaterials = [];
		this.laserEditPointTemplate = new VModelTemplate(
			THREE.Mesh,
			this._createPlaneGeometry(-4, -4, 8, 8),
			new THREE.MeshBasicMaterial({'color': this.view.color.selected, 'opacity': 0.7, 'transparent': true})
		);

		this.laserDrawingMaterials = [];
		this.laserDrawingPoints = [];
		this.view.color.hueLasers.forEach((hue, lane) => {
			this.laserBodyMaterials.push(this._createLaserBodyMaterial(hue, 0.6));
			this.laserDrawingMaterials.push(this._createLaserBodyMaterial(hue, 0.9));

			const drawing = new VLaserRenderPoint(this, lane, 0, null, null, true);
			this.laserDrawings.add(drawing.object);
			this.laserDrawingPoints.push(drawing);
		});
	}
	_createLaserBodyMaterial(hue, lightness) {
		const color = new THREE.Color();
		color.setHSL(hue/360, 1.0, lightness);
		return new THREE.MeshBasicMaterial({
			'color': color,
			'opacity': 0.5,
			'transparent': true
		});
	}

	_initTickPropData() {
		const color = this.view.color;

		this.tickProps = this._createGroup(VVIEW_EDITOR_UI_Z);
		this.tickPropsByY = {};

		this.bpmLineTemplate = new VModelTemplate(THREE.Line,
			this.cursorLineGeometry,
			new THREE.LineBasicMaterial({'color': color.textBPM})
		);
	}

	_initEditorUIDrawData() {
		const color = this.view.color;
		const scale = this.view.scale;

		this.cursors = this._createGroup(VVIEW_EDITOR_UI_Z);

		const cursorTemplate = new VModelTemplate(THREE.Line,
			this.cursorLineGeometry,
			new THREE.LineBasicMaterial({'color': color.cursor})
		);

		this.cursorStart = cursorTemplate.create();
		this.cursorEnd = cursorTemplate.create();

		this.selection = new THREE.Mesh(
			this._createPlaneGeometry(scale.cursorLeft, 0, scale.cursorRight-scale.cursorLeft, 50),
			new THREE.MeshBasicMaterial({'color': color.selected, 'opacity': color.rangeSelectOpacity, 'transparent': true})
		);
		this.selection.visible = false;

		this.cursors.add(this.selection);

		this.cursors.add(this.cursorStart);
		this.cursors.add(this.cursorEnd);
	}

	_createGroup(z) {
		const group = new THREE.Group();
		this.scene.add(group);

		group.position.z = z;
		return group;
	}
	_createLineGeometry(a, b) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([
			a.x, a.y, a.z, b.x, b.y, b.z
		], 3));
		geometry.computeBoundingSphere();

		return geometry;
	}
	_createPlaneGeometry(x, y, w, h) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([
			x, y, 0, x+w, y, 0, x+w, y+h, 0,
			x, y, 0, x+w, y+h, 0, x, y+h, 0,
		], 3));
		geometry.computeBoundingSphere();

		return geometry;
	}
	_createRectangleTemplate(x, y, w, h, fill, stroke) {
		const templates = [];

		if(fill) {
			const planeGeometry = stroke ?
				this._createPlaneGeometry(x+0.5, y+0.5, w-1, h-1) :
				this._createPlaneGeometry(x, y, w, h);
			templates.push(new VModelTemplate(THREE.Mesh, planeGeometry, new THREE.MeshBasicMaterial({'color': fill})));
		}

		if(stroke) {
			const edges = new THREE.EdgesGeometry(this._createPlaneGeometry(x, y, w, h));
			templates.push(new VModelTemplate(THREE.Line, edges, new THREE.LineBasicMaterial({'color': stroke})));
		}

		return new VModelTemplateCollection(templates);
	}
}
