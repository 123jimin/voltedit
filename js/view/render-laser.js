/// Managing a laser graph point
class VLaserGraphPoint {
	constructor(render, lane, iy, wide, currNode, nextNode) {
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

		this.update(iy, wide, currNode, nextNode);
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
	update(iy, wide, currNode, nextNode) {
		this._wide = wide;
		this._x = this.getX(currNode.data.v);
		this._xf = this.getX(currNode.data.vf);
		this._y = this.getY(currNode.y);

		this.object.position.y = this.getY(iy);
		this._updateSlam(wide, currNode);
		this._updateEdge(wide, currNode, nextNode);
		this._updateTail(wide, currNode, nextNode);
	}
	_updateSlam(wide, node) {
		if(!node.data.isSlam()){
			this.slam.visible = false;
			return;
		}

		const HALF_LASER = this.view.scale.noteWidth/2-0.5;
		const SLAM_HEIGHT = this.view.scale.laserSlamHeight;
		let [xmin, xmax] = [this._x, this._xf];
		if(xmin > xmax) [xmin, xmax] = [xmax, xmin];

		const points = [];
		RECT(points, [xmin-HALF_LASER, 0], [xmax+HALF_LASER, SLAM_HEIGHT]);

		this.slam.visible = true;
		this.slam.position.y = this._y;
		RenderHelper.updateGeometry(this.slam, points);
	}
	_updateEdge(wide, currNode, nextNode) {
		if(!nextNode){
			this.edge.visible = false;
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

		this.edge.visible = true;
		this.edge.position.y = this._y;
		RenderHelper.updateGeometry(this.edge, points);
	}
	_updateTail(wide, currNode, nextNode) {
		if(nextNode){
			this.tail.visible = false;
			return;
		}
		if(!currNode.data.isSlam()){
			this.tail.visible = false;
			return;
		}
		this.tail.visible = true;
		this.tail.position.set(this._xf, this._y+this.view.scale.laserSlamHeight, 0);
	}
	_createMesh(points) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.computeBoundingSphere();

		const obj = new THREE.Mesh(geometry, this.getMaterial());
		obj.userData._disposeGeometry = true;
		this.object.add(obj);

		return obj;
	}
	_createQuad(p1, p2, p3, p4) {
		const points = [];
		QUAD(points, p1, p2, p3, p4);

		return this._createMesh(points);
	}
}
