/// Managing a laser slam
class VLaserSlam {
}
/// Managing a laser edge
class VLaserEdge {

}
/// Managing a laser graph point
class VLaserGraphPoint {
}
/// Managing a laser segment
class VLaserSegment {
	constructor(render, lane, graph){
		this.render = render;
		this.view = render.view;
		this.lane = lane;
		this.graph = graph;

		this._object = new THREE.Object3D();

		this.lasers.add(this._object);
	}
}
