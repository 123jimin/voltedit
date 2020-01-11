/// Contains rendering-related stuff
const VVIEW_CAMERA_Z = 128;
const VVIEW_EDITOR_UI_Z = 10;

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
		const offset = view.height;
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

class VTickPropText {
	constructor(parent, isRight) {
		const scale = parent.render.view.scale;
		
		this.parent = parent;
		this.isRight = isRight;

		const ctx = this.ctx = document.createElement('canvas').getContext('2d');
		
		const fontSize = this.fontSize = scale.tickPropFontSize;
		this.width = ctx.canvas.width = fontSize*4;
		this.height = ctx.canvas.height = fontSize*3;

		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.font = `${fontSize}px monospace`;
		ctx.textBaseline = 'top';
		ctx.textAlign = this.isRight ? 'right' : 'left';

		const texture = this.texture = new THREE.CanvasTexture(ctx.canvas);
		texture.minFilter = THREE.LinearFilter;

		const panel = this.panel = new THREE.Mesh(
			new THREE.PlaneGeometry(ctx.canvas.width, ctx.canvas.height),
			new THREE.MeshBasicMaterial({'map': texture, 'transparent': true})
		);

		panel.position.x = isRight ? scale.columnRight-this.width/2 : scale.columnLeft+this.width/2;
		panel.position.y = ctx.canvas.height/2 + 2;

		parent._object.add(panel);
	}
	redraw() {
		const ctx = this.ctx;
		const fontSize = this.fontSize;
		const fields = this.isRight ? this.parent._rightFields : this.parent._leftFields;

		let firstColor = null;
		
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		
		const currX = this.isRight ? this.width : 0;
		let currY = this.height;

		fields.forEach(([field, color]) => {
			if(!(field in this.parent._texts)) return;
			const text = this.parent._texts[field];
			if(text.length === 0) return;

			currY -= fontSize;

			ctx.fillStyle = color;
			if(!firstColor) firstColor = color;
			
			ctx.fillText(text, currX, currY);
		});

		this.texture.needsUpdate = true;
		return firstColor;
	}
}

/// Managing data shown on a tick
class VTickProp {
	constructor(render, tick) {
		this.render = render;
		this.tick = tick;

		this._initFields();
		
		this._object = new THREE.Object3D();
		this._object.position.y = this.render.view.t2p(tick);
		this.render.tickProps.add(this._object);

		this._lineMaterial = new THREE.LineBasicMaterial({'color': "white"});
		this._line = new THREE.Line(this.render.cursorLineGeometry, this._lineMaterial);
		this._object.add(this._line);
		
		this._texts = {};
		this._initTextArea();
	}
	_initFields() {
		const color = this.render.view.color;

		/// Texts will be drawn in this order, from the bottom.
		this._leftFields = [];
		this._rightFields = [
			['bpm', color.textBPM],
			['timeSig', color.textTimeSig],
		];
	}
	_initTextArea() {
		this._leftPanel = new VTickPropText(this, false);
		this._rightPanel = new VTickPropText(this, true);
		
		this._redrawFlag = false;
	}
	setBPM(bpm) {
		this._setText('bpm', `${bpm}`);
	}
	setTimeSig(n, d) {
		this._setText('timeSig', `${n}/${d}`);
	}
	_setText(id, value) {
		this._texts[id] = value;
		this._redrawFlag = true;
	}
	
	redraw() {
		if(!this._redrawFlag) return;

		const leftColor = this._leftPanel.redraw();
		const rightColor = this._rightPanel.redraw();
		const color = leftColor || rightColor || null;
		
		if(this._line.visible = color !== null){
			this._lineMaterial.color.set(color);
		}

		this._redrawFlag = false;
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

		this.fxNotesByY = {};
		this.btNotesByY = {};
	}
	addBtNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.btShorts, this.btShortTemplate, lane, pos);
		} else {
			note = this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth, 1, this.view.color.btLong, len), lane, pos);
		}
		this.btNotesByY[pos] = note;
	}
	addFxNote(lane, pos, len) {
		let note = null;
		if(len === 0) {
			note = this._addNote(this.fxShorts, this.fxShortTemplate, lane*2, pos);
		} else {
			note = this._addNote(this.btLongs, this._createLongNoteTemplate(this.view.scale.noteWidth*2, 0, this.view.color.fxLong, len), lane*2, pos);
		}
		this.fxNotesByY[pos] = note;
	}
	_addNote(noteCollection, noteTemplate, lane, pos) {
		const scale = this.view.scale;
		const note = noteTemplate.create();
		note.position.set((lane-2)*scale.noteWidth, RD(this.view.t2p(pos)), 0);
		noteCollection.add(note);

		return note;
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
	_getTickProp(pos) {false
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

		this.fxNotesByY = {};
		this.btNotesByY = {};

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
		const scale = this.view.scale;
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