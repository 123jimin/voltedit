/// Managing tick prop text (BPM, timeSig, ...)
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
