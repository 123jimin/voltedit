/// Managing a laser graph point
class VLaserGraphPoint {
	constructor(segment, prevNode, node) {
		this.parent = segment;
		this.object = new THREE.Object3D();

		const HALF_LASER = segment.view.scale.noteWidth/2-0.5;
		const x = segment.getX(node.data.v);
		const y = segment.getY(node.y);

		this.slam = null;
		if(node.data.isSlam()){
			const xf = segment.getX(node.data.vf);
			const yf = y+segment.view.scale.laserSlamHeight;
			let [xmin, xmax] = [x, xf];
			if(x > xf) [xmin, xmax] = [xf, x];

			this.slam = this.createMesh(
				[xmin-HALF_LASER, y], [xmax+HALF_LASER, y],
				[xmax+HALF_LASER, yf], [xmin-HALF_LASER, yf]
			);
		}
		this.slam && this.object.add(this.slam);

		this.edge = null;
		if(prevNode){
			const prevX = segment.getX(prevNode.data.vf);
			let prevY = segment.getY(prevNode.y);
			if(prevNode.data.isSlam()){
				prevY += segment.view.scale.laserSlamHeight;
			}

			this.edge = this.createMesh(
				[prevX-HALF_LASER, prevY], [prevX+HALF_LASER, prevY],
				[x+HALF_LASER, y], [x-HALF_LASER, y]
			);
		}
		this.edge && this.object.add(this.edge);
	}
	createMesh(p1, p2, p3, p4) {
		const points = [];
		QUAD(points, p1, p2, p3, p4);

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.computeBoundingSphere();

		const obj = new THREE.Mesh(geometry, this.parent.getMaterial());
		obj.userData._disposeGeometry = true;

		return obj;
	}
}
/// Managing a laser segment
class VLaserSegment {
	constructor(render, lane, graph) {
		this.render = render;
		this.view = render.view;
		this.lane = lane;
		this.graph = graph;

		this.points = [];
		this.object = new THREE.Object3D();
		this.tail = null;
		this.build();
	}
	getX(v) {
		return this.graph.wide * (v-0.5) * this.view.scale.laserPosWidth;
	}
	getY(ry) {
		return this.view.t2p(ry);
	}
	getMaterial() {
		return this.render.laserBodyMaterials[this.lane];
	}
	build() {
		this.object.position.y = this.getY(this.graph.iy);
		if(this.graph.points.size === 0) return;

		let prevNode = null;
		this.graph.points.traverse((node) => {
			const point = new VLaserGraphPoint(this, prevNode, node);
			this.points.push(point);
			this.object.add(point.object);
			prevNode = node;
		});

		this._makeTail();
		this.tail && this.object.add(this.tail);
	}
	destroy() {

	}

	_makeTail() {
		const lastPoint = this.graph.points.last();
		if(!lastPoint) return;
		if(!lastPoint.data.isSlam()) return;

		const lastX = this.getX(lastPoint.data.vf);
		const lastY = this.getY(lastPoint.y) + this.view.scale.laserSlamHeight;
		const HALF_LASER = this.view.scale.noteWidth/2-0.5;

		const points = [
			-HALF_LASER, 0, 0,
			HALF_LASER, 0, 0,
			0, HALF_LASER*2, 0,
		];
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.computeBoundingSphere();

		this.tail = new THREE.Mesh(geometry, this.getMaterial());
		this.tail.userData._disposeGeometry = true;
		this.tail.position.set(lastX, lastY, 0);
	}
}
