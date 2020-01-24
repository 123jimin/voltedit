/// Managing a laser graph point
class VLaserRenderPoint {
	constructor(render, lane, currNode, nextNode) {
		this.render = render;
		this.view = render.view;
		this.lane = lane;
		this.object = new THREE.Object3D();

		// Will be updated to the proper value later.
		const TEMPLATE_RECT = [[0, 0], [1, 0], [1, 1], [0, 1]];
		this.slam = this._createQuad(...TEMPLATE_RECT);
		this.edge = this._createQuad(...TEMPLATE_RECT);

		const HALF_LASER = this.view.scale.noteWidth/2-0.5;
		this.tail = this._createMesh([
			-HALF_LASER, 0, 0,
			HALF_LASER, 0, 0,
			0, HALF_LASER*2, 0,
		]);

		this.editV = this._createEdit();
		this.editVF = this._createEdit();

		this.update(currNode, nextNode);
		this.selSlam(false);
		this.selEdge(false);
		this.selEditPoint(false, false);
		this.selEditPoint(true, false);
	}
	getMaterial() {
		return this.render.laserBodyMaterials[this.lane];
	}
	getX(v) {
		return this._wide * (v-0.5) * this.view.scale.laserPosWidth;
	}
	getY(ry) {
		return this.view.t2p(ry);
	}
	update(currNode, nextNode) {
		this._wide = currNode.data.wide;
		this._x = this.getX(currNode.data.v);
		this._xf = this.getX(currNode.data.vf);
		this._y = this.getY(currNode.y);
		this.object.position.y = this._y;

		this._updateSlam(currNode);
		this._updateEdge(currNode, nextNode);
		this._updateTail(currNode, nextNode);
		this._updateEdit(currNode);
	}
	selSlam(slam) {
		this.slam[1].visible = this.slam[0].visible && slam;
		if(!this.edge[0].visible) this.tail[1].visible = this.tail[0].visible && slam;
	}
	selEdge(edge) {
		this.edge[1].visible = this.edge[0].visible && edge;
		if(this.edge[0].visible) this.tail[1].visible = this.tail[0].visible && edge;
	}
	selEditPoint(isVF, selected) {
		if(isVF) this.editVF.visible = this.slam[0].visible && selected;
		else this.editV.visible = selected;
	}
	_updateSlam(node) {
		if(!node.data.isSlam()){
			this.slam[0].visible = false;
			this.slam[1].visible = false;
			return;
		}

		const HALF_LASER = this.view.scale.noteWidth/2-0.5;
		const SLAM_HEIGHT = this.view.scale.laserSlamHeight;
		let [xmin, xmax] = [this._x, this._xf];
		if(xmin > xmax) [xmin, xmax] = [xmax, xmin];

		const points = [];
		RECT(points, [xmin-HALF_LASER, 0], [xmax+HALF_LASER, SLAM_HEIGHT]);

		this.slam[0].visible = true;
		RenderHelper.updateGeometry(this.slam[0], points);
	}
	_updateEdge(currNode, nextNode) {
		if(!nextNode || !currNode.data.connected){
			this.edge[0].visible = false;
			this.edge[1].visible = false;
			return;
		}

		const HALF_LASER = this.view.scale.noteWidth/2-0.5;
		const SLAM_HEIGHT = this.view.scale.laserSlamHeight;

		const nx = this.getX(nextNode.data.v);
		const ny = this.getY(nextNode.y) - this._y;

		let y = 0;
		if(currNode.data.isSlam()) y = SLAM_HEIGHT;

		const points = [];
		QUAD(points,
			[this._xf-HALF_LASER, y],
			[this._xf+HALF_LASER, y],
			[nx+HALF_LASER, ny],
			[nx-HALF_LASER, ny],
		);

		this.edge[0].visible = true;
		RenderHelper.updateGeometry(this.edge[0], points);
	}
	_updateTail(currNode, nextNode) {
		if(nextNode && currNode.data.connected){
			this.tail[0].visible = false;
			this.tail[1].visible = false;
			return;
		}

		if(!currNode.data.isSlam()){
			this.tail[0].visible = false;
			this.tail[1].visible = false;
			return;
		}

		const tailY = currNode.data.isSlam() ? this.view.scale.laserSlamHeight : 0;

		this.tail[0].visible = true;
		this.tail[0].position.set(this._xf, tailY, 0);
		this.tail[1].position.copy(this.tail[0].position);
	}
	_updateEdit(currNode) {
		this.editV.position.x = this._x;
		if(currNode.data.isSlam()){
			this.editVF.position.x = this._xf;
		}else{
			this.editVF.visible = false;
		}
	}
	_createMesh(points) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.computeBoundingSphere();

		const obj = new THREE.Mesh(geometry, this.getMaterial());
		const objSelected = new THREE.Mesh(geometry, this.render.selectedMaterial);

		// Delete once
		obj.userData._disposeGeometry = true;

		this.object.add(obj);
		this.object.add(objSelected);

		return [obj, objSelected];
	}
	_createQuad(p1, p2, p3, p4) {
		const points = [];
		QUAD(points, p1, p2, p3, p4);

		return this._createMesh(points);
	}
	_createEdit() {
		const obj = this.render.laserEditPointTemplate.create();
		this.object.add(obj);
		return obj;
	}

	dispose() {
		RenderHelper.dispose(this.object);
	};
}
