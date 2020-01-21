/// Contains various components related to chart rendering
const VVIEW_CAMERA_Z = 128;
const VVIEW_EDITOR_UI_Z = 10;

/// Contains rendering-related classes for a single column of VView.
class VViewColumn {
	constructor(render, index) {
		this.parent = render;
		this.index = index;
		this.enabled = true;

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
