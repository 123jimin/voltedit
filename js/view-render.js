/// Contains rendering-related stuff
const VVIEW_CAMERA_Z = 128;

/// Contains rendering-related classes for a single column of VView.
class VViewColumn {
	constructor(render, index) {
		this.parent = render;
		this.index = index;
		this.enabled = true;

		const scale = render.view.scale;
		this.camera = new THREE.OrthographicCamera(
			-50, 50, 100, 0, // The correct values will be set later
		);
		this.camera.position.set(0, 0, VVIEW_CAMERA_Z);
		// this.camera.lookAt(0, 0, 0);
	}
	resize() {
		const view = this.parent.view;
		const scale = view.scale;
		this.camera.left = scale.columnLeft;
		this.camera.right = scale.columnRight;
		this.camera.bottom = -scale.marginBottom;
		this.camera.top = view.height-scale.marginBottom;
		this.camera.updateProjectionMatrix();
	}
	updateLocation() {
		const view = this.parent.view;
		const base = view.t2p(view.tickLoc);
		const offset = view.t2p(view.height);
		this.camera.position.y = base + this.index*offset;
	}
	render() {
		if(!this.enabled) return;
		const renderer = this.parent.renderer;
		const view = this.parent.view;
		const scale = view.scale;

		const left = scale.marginSide+scale.columnOffset*this.index;
		const top = 0;
		const width = scale.columnWidth;
		const height = view.height;
		renderer.setViewport(left, top, width, height);
		renderer.setScissor(left, top, width, height);
		renderer.setScissorTest(true);
		renderer.render(this.parent.scene, this.camera);
	}
}

/// Managing a geometry, a material, and an object type together
class VModelTemplate {
	constructor(type, geometry, material) {
		this.type = type;
		this.geometry = geometry;
		this.material = material;
	}
	create() {
		return new this.type(this.geometry, this.material);
	}
}

/// Managing a collection of templates together
class VModelTemplateCollection {
	constructor(templates) {
		this.templates = templates;
	}
	create() {
		const obj = new THREE.Object3D();
		this.templates.forEach((template) => {
			obj.add(template.create());
		});
		return obj;
	}
}

/// VView will take charge of managing the data, and VViewRender will receive things to draw/move/delete.
class VViewRender {
	constructor(view) {
		this.view = view;
		this.elem = view.elem.querySelector(".chart-view");

		this.scene = new THREE.Scene();
		this.renderer = new THREE.WebGLRenderer({
			'alpha': true, 'antialias': false,
			'precision': 'mediump', 'powerPreference': 'low-power',
		});
		this.renderer.sortObjects = false;
		this.renderer.setClearColor(0, 0);
		this.renderer.setSize(this.view.scale.elemWidth, 100 /* will be adjusted later */);
		this.elem.appendChild(this.renderer.domElement);

		this._initDrawData();

		this.columns = [];
		this._addColumn();
	}

	clearMeasures() {
		this._clear(this.measureLines);
		this._clear(this.measureProps);
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

	clearNotes() {
		this._clear(this.fxLongs);
		this._clear(this.btLongs);
		this._clear(this.fxShorts);
		this._clear(this.btShorts);
	}
	addBtNote(lane, pos, len) {
		if(len === 0) {
			this._addNote(this.btShorts, this.btShortTemplate, lane, pos);
		} else {
			this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth, 1, this.view.color.btLong, len), lane, pos);
		}
	}
	addFxNote(lane, pos, len) {
		if(len === 0) {
			this._addNote(this.fxShorts, this.fxShortTemplate, lane*2, pos);
		} else {
			this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth*2, 0, this.view.color.fxLong, len), lane*2, pos);
		}
	}
	_addNote(noteCollection, noteTemplate, lane, pos) {
		const scale = this.view.scale;
		const note = noteTemplate.create();
		note.position.set((lane-2)*scale.noteWidth, RD(this.view.t2p(pos)), 0);
		noteCollection.add(note);
	}

	clearLasers() {
		this._clear(this.lasers);
	}
	addLaser(index, y, graph) {
		if(!graph || !('v' in graph) || !graph.v.length) return;

		const scale = this.view.scale;
		const WIDE = 'wide' in graph ? graph.wide : 1;
		const HALF_LASER = scale.noteWidth/2-0.5;

		const X = (v) => WIDE*(v-0.5)*scale.laserPosWidth;
		const Y = (ry) => this.view.t2p(ry+y);

		const rightSide = [], leftSide = [];
		graph.v.forEach((gp, ind) => {
			const x = X(gp.v), y = Y(gp.ry);
			if(ind === 0){
				rightSide.push();
			}else{
				rightSide.push();
			}
		});
	}

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
		this.columns.forEach((column) => column.render());
	}
	_initDrawData() {
		this._initMeasureDrawData();
		this._initNoteDrawData();

		this.lasers = this._createGroup(10);
	}
	_initMeasureDrawData() {
		const scale = this.view.scale;
		const color = this.view.color;

		this.measureLines = this._createGroup(-10);
		this.measureProps = this._createGroup(-9);

		this.laneCrossingLineGeometry = this._createLineGeometry(
			new THREE.Vector3(scale.laneLeft, 0, 0),
			new THREE.Vector3(scale.laneRight, 0, 0),
		);

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
		this.btLongs = this._createGroup(1);
		this.fxShorts = this._createGroup(2);
		this.btShorts = this._createGroup(3);

		this.btShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth, scale.btNoteHeight, color.btFill, color.btBorder);
		this.fxShortTemplate = this._createRectangleTemplate(0, 0, scale.noteWidth*2, scale.fxNoteHeight, color.fxFill, color.fxBorder);
	}
	_createLongNoteTemplate(width, padding, color, len) {
		return this._createRectangleTemplate(padding, 0, width-padding*2, this.view.t2p(len), color);
	}
	_createGroup(z) {
		const group = new THREE.Group();
		this.scene.add(group);

		group.position.set(0, 0, z);
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
