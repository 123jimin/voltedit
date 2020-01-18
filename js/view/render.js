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

			const geometry = this.selection.geometry;
			const geometry_position = geometry.attributes.position;
			points.forEach((value, ind) => geometry_position.array[ind] = value);
			geometry_position.needsUpdate = true;
			geometry.computeBoundingSphere();
		}
	}

	/** Drawing measure data **/
	clearMeasures() {
		this._clear(this.measureLines);
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
		this._clear(this.fxLongs);
		this._clear(this.btLongs);
		this._clear(this.fxShorts);
		this._clear(this.btShorts);

		// [note, noteSelected]
		this.fxNotesByY = [{}, {}];
		this.btNotesByY = [{}, {}, {}, {}];
	}
	addBtNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.btShorts, this.btShortTemplate, this.btShortSelectedTemplate, lane, pos);
		} else {
			note = this._addLongNote(this.btLongs, this.view.scale.noteWidth, 1,
				this.view.color.btLong ,this.view.color.selected, lane, pos, len);
		}
		this.btNotesByY[lane][pos] = note;
	}
	addFxNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.fxShorts, this.fxShortTemplate, this.fxShortSelectedTemplate, lane*2, pos);
		} else {
			note = this._addLongNote(this.fxLongs, this.view.scale.noteWidth*2, 0,
				this.view.color.fxLong ,this.view.color.selected, lane*2, pos, len);
		}
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

		this._remove(noteSelected);
		this._remove(note);
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
		this.btShortDrawing.position.set((lane-2)*this.view.scale.noteWidth, RD(this.view.t2p(pos)), 0);
	}
	showFXDrawing(lane, pos) {
		this.fxShortDrawing.visible = true;
		this.fxShortDrawing.position.set((lane-1)*2*this.view.scale.noteWidth, RD(this.view.t2p(pos)), 0);
	}
	hideDrawing() {
		this.btShortDrawing.visible = false;
		this.fxShortDrawing.visible = false;
	}

	/** Drawing laser data **/
	clearLasers() {
		this._clear(this.lasers);
	}
	addLaser(index, graph) {
		const laserObject = new THREE.Group();
		const scale = this.view.scale;
		const WIDE = graph.wide;
		const HALF_LASER = scale.noteWidth/2-0.5;

		const X = (v) => WIDE*(v-0.5)*scale.laserPosWidth;
		const Y = (ry) => this.view.t2p(ry);

		laserObject.position.y = Y(graph.iy);

		if(graph.points.size > 0){
			const points = [];
			let prevX = 0, prevY = 0;
			let isFirstNode = true;

			// TODO: make each GraphSectionPoint a separate object
			graph.points.traverse((node) => {
				const gp = node.data;
				const x = X(gp.v), y = Y(node.y);
				if(isFirstNode){
					isFirstNode = false;
				}else{
					QUAD(points,
						[prevX-HALF_LASER, prevY], [prevX+HALF_LASER, prevY],
						[x+HALF_LASER, y], [x-HALF_LASER, y]
					);
				}
				if(gp.isSlam()){
					const xf = X(gp.vf);
					const yf = y+scale.laserSlamHeight;
					let [xmin, xmax] = [x, xf];
					if(x > xf) [xmin, xmax] = [xf, x];

					QUAD(points,
						[xmin-HALF_LASER, y], [xmax+HALF_LASER, y],
						[xmax+HALF_LASER, yf], [xmin-HALF_LASER, yf]
					);

					[prevX, prevY] = [xf, yf];
				}else{
					[prevX, prevY] = [x, y];
				}
			});

			if(points.length === 0){
				return;
			}

			// Draw end for last slam
			if(graph.points.last().data.isSlam()){
				points.push(prevX-HALF_LASER, prevY, 0, prevX+HALF_LASER, prevY, 0, prevX, prevY+HALF_LASER*2, 0);
			}

			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
			geometry.computeBoundingSphere();

			const material = this.laserBodyMaterials[index];
			const laserBody = new THREE.Mesh(geometry, material);

			laserObject.add(laserBody);
		}
		this.lasers.add(laserObject);
	}

	/** Drawing tick props **/
	clearTickProps() {
		this._clear(this.tickProps);
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

		// TODO: let's support more than 4 columns, because why not
		this.btNotesByY = [{}, {}, {}, {}];
		this.fxNotesByY = [{}, {}];

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
		this.lasers = this._createGroup(CLIP(this.view.scale.laserFloat, 1, VVIEW_EDITOR_UI_Z));

		this.laserBodyMaterials = [0, 1].map((index) => this._createLaserBodyMaterial(index));
	}
	_createLaserBodyMaterial(index) {
		return new THREE.MeshBasicMaterial({
			'color': this._getLaserBodyColor(index),
			'opacity': 0.5,
			'transparent': true
		});
	}
	_getLaserBodyColor(index) {
		const hue = index === 0 ? this.view.color.hueLaserLeft : this.view.color.hueLaserRight;
		const color = new THREE.Color();
		color.setHSL(hue/360, 1.0, 0.6);
		return color;
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
	_clear(elem) {
		for(let i=elem.children.length; i-->0;) {
			this._remove(elem.children[i]);
		}
	}
	_remove(elem) {
		elem.parent.remove(elem);
		if(elem.userData){
			const disposeGeometry = !!(elem.userData._disposeGeometry);
			const disposeMaterial = !!(elem.userData._disposeMaterial);
			const checkDispose = (elem) => {
				if('geometry' in elem && disposeGeometry) elem.geometry.dispose();
				if('material' in elem && disposeMaterial) elem.material.dispose();
			};

			elem.children.forEach(checkDispose);
			checkDispose(elem);
		}
	}
}
