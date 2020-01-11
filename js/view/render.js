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

		this.fxNotesByY = [{}, {}];
		this.btNotesByY = [{}, {}, {}, {}];
	}
	addBtNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.btShorts, this.btShortTemplate, lane, pos);
		} else {
			note = this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth, 1, this.view.color.btLong, len), lane, pos);
		}
		this.btNotesByY[lane][pos] = note;
	}
	addFxNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.fxShorts, this.fxShortTemplate, lane*2, pos);
		} else {
			note = this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth*2, 0, this.view.color.fxLong, len), lane*2, pos);
		}
		this.fxNotesByY[lane][pos] = note;
	}
	_addNote(noteCollection, noteTemplate, lane, pos) {
		const scale = this.view.scale;
		const note = noteTemplate.create();
		note.position.set((lane-2)*scale.noteWidth, RD(this.view.t2p(pos)), 0);
		noteCollection.add(note);

		return note;
	}
	delBtNote(lane, pos) {
		this._delNote(this.btNotesByY, lane, pos);
	}
	delFxNote(lane, pos) {
		this._delNote(this.fxNotesByY, lane, pos);
	}
	_delNote(notesByY, lane, pos){
		const note = notesByY[lane][pos];
		note.parent.remove(note);

		delete notesByY[lane][pos];
	}

	/** Drawing laser data **/
	clearLasers() {
		this._clear(this.lasers);
	}
	addLaser(index, y, graph) {
		if(!graph || !('v' in graph) || !graph.v.length) return;

		const laserObject = new THREE.Object3D();
		const scale = this.view.scale;
		const WIDE = 'wide' in graph ? graph.wide : 1;
		const HALF_LASER = scale.noteWidth/2-0.5;

		const X = (v) => WIDE*(v-0.5)*scale.laserPosWidth;
		const Y = (ry) => this.view.t2p(ry);

		laserObject.position.y = Y(y);

		const points = [];
		let prevX = 0, prevY = 0;
		graph.v.forEach((gp, ind) => {
			const x = X(gp.v), y = Y(gp.ry);
			if(ind === 0){
			}else{
				QUAD(points,
					[prevX-HALF_LASER, prevY], [prevX+HALF_LASER, prevY],
					[x+HALF_LASER, y], [x-HALF_LASER, y]
				);
			}
			if('vf' in gp){
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
		const last = graph.v[graph.v.length-1];
		if('vf' in last){
			points.push(prevX-HALF_LASER, prevY, 0, prevX+HALF_LASER, prevY, 0, prevX, prevY+HALF_LASER*2, 0);
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.computeBoundingSphere();

		const material = index === 0 ? this.leftLaserBodyMaterial : this.rightLaserBodyMaterial;
		const laserBody = new THREE.Mesh(geometry, material);

		laserObject.add(laserBody);
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

		this.fxNotesByY = [{}, {}];
		this.btNotesByY = [{}, {}, {}, {}];

		this.btShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth, scale.btNoteHeight, color.btFill, color.btBorder);
		this.fxShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth*2, scale.fxNoteHeight, color.fxFill, color.fxBorder);
	}
	_createLongNoteTemplate(width, padding, color, len) {
		return this._createRectangleTemplate(padding, 0, width-padding*2, this.view.t2p(len), color);
	}

	_initLaserDrawData() {
		this.lasers = this._createGroup(CLIP(this.view.scale.laserFloat, 1, VVIEW_EDITOR_UI_Z));

		this.leftLaserBodyMaterial = this._createLaserBodyMaterial(0);
		this.rightLaserBodyMaterial = this._createLaserBodyMaterial(1);
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

		this.cursors = this._createGroup(VVIEW_EDITOR_UI_Z);

		const cursorTemplate = new VModelTemplate(THREE.Line,
			this.cursorLineGeometry,
			new THREE.LineBasicMaterial({'color': color.cursor})
		);

		this.cursorStart = cursorTemplate.create();
		this.cursorEnd = cursorTemplate.create();

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
		const planeGeometry = this._createPlaneGeometry(x+0.5, y+0.5, w-1, h-1);
		templates.push(new VModelTemplate(THREE.Mesh, planeGeometry, new THREE.MeshBasicMaterial({'color': fill})));

		if(stroke) {
			const edges = new THREE.EdgesGeometry(this._createPlaneGeometry(x, y, w, h));
			templates.push(new VModelTemplate(THREE.Line, edges, new THREE.LineBasicMaterial({'color': stroke})));
		}

		return new VModelTemplateCollection(templates);
	}
	_clear(elem) {
		for(let i=elem.children.length; i-->0;) {
			elem.remove(elem.children[i]);
		}
	}
}
