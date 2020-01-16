const readFile = (file) => new Promise((resolve, reject) => {
	if(typeof(file.text) === 'function'){
		file.text().then(resolve).catch(reject);
		return;
	}

	const reader = new FileReader();
	reader.addEventListener('error', reject);
	reader.addEventListener('load', (event) => {
		resolve(reader.result);
	});

	reader.readAsText(file);
});

/// A class for managing reading/writing files
class VFileManager {
	constructor(editor) {
		const elem = editor.elem;
		this.editor = editor;

		this.dropFileIndicator = elem.querySelector('.drop-file-indicator');
		this.dropFileIndicatorShown = false;

		this.useNativeFS = window.chooseFileSystemEntries && typeof(window.chooseFileSystemEntries) === 'function';
	}
	async showOpenChartDialog() {
		let resultFile = null;
		if(this.useNativeFS) resultFile = await this._showOpenChartDialogFS();
		else resultFile = this._showOpenChartDialogHTML();

		if(!resultFile) return;

		this.openChartFile(resultFile);
	}
	_showOpenChartDialogHTML() {
		return new Promise((resolve, reject) => {
			const fileInput = document.createElement('input');
			fileInput.setAttribute('type', 'file');
			fileInput.setAttribute('accept', ".ksh, .kson");
			fileInput.addEventListener('change', (event) => {
				const files = fileInput.files;
				if(files.length !== 1) return resolve(null);

				resolve([null, fileInput.files[0]]);
				fileInput.remove();
			});
			fileInput.click();
		});
	}
	async _showOpenChartDialogFS() {
		const fileHandle = await window.chooseFileSystemEntries({
			'type': 'openFile', 'multiple': false, 'accepts': [{
				'description': "k-shoot mania chart file",
				'extensions': ['ksh', 'kson'],
			}]
		});
		if(!fileHandle) return null;

		const file = await fileHandle.getFile();
		if(!file) return null;

		return [fileHandle, file];
	}
	async openChartFile([fileHandle, file]) {
		if(!file) return;
		console.time("Reading");
		const text = await readFile(file);
		console.timeEnd("Reading");

		console.time("Parsing");
		const chartData = VChartData.create(text);
		console.timeEnd("Parsing");

		if(chartData == null) {
			this.editor.error(L10N.t('error-reading-chart-data'));
			return;
		}

		chartData.fileHandle = fileHandle || null;
		this.editor.setChartData(chartData);
	}
	async saveChart() {
		const chartData = this.editor.chartData;
		if(!chartData) return;

		if(!chartData.fileHandle){
			this.saveChartAs();
			return;
		}

		try{
			let data = null;
			if(chartData instanceof KSHData) data = KSHData.toKSH(chartData);
			else data = KSONData.toKSON(chartData);

			const writer = await chartData.fileHandle.createWriter({'keepExistingData': false});
			await writer.write(0, data);
			await writer.close();
		}catch(e){
			this.editor.error(e);
			return false;
		}

		this.editor.info(`File saved as ${chartData.fileHandle.name}!`);
	}
	async saveChartAs() {
		const chartData = this.editor.chartData;
		if(!chartData) return;

		if(!this.useNativeFS){
			this.saveChartAsKSON();
			return;
		}
		
		try{
			let fileHandle = await window.chooseFileSystemEntries({
				'type': 'saveFile', 'accepts': [{
					'description': "k-shoot mania chart file",
					'extensions': ['ksh', 'kson'],
				}],
			});
			if(!fileHandle) return;

			let data = null;

			if(fileHandle.name.endsWith(".ksh")) data = KSHData.toKSH(chartData);
			else data = KSONData.toKSON(chartData);

			const writer = await fileHandle.createWriter({'keepExistingData': false});
			await writer.write(0, data);
			await writer.close();

			chartData.fileHandle = fileHandle;
		
			this.editor.info(`File saved as ${fileHandle.name}!`);
		}catch(e){
			this.editor.error(e);
			return;
		}
	}
	saveToKSON() {
		const chartData = this.editor.chartData;
		if(!chartData) return;
		try{
			this.saveFileAs("kson", KSONData.toKSON(chartData));
		}catch(e){
			this.editor.error(e);
		}
	}
	saveToKSH() {
		const chartData = this.editor.chartData;
		if(!chartData) return;
		try{
			this.saveFileAs("ksh", KSHData.toKSH(chartData));
		}catch(e){
			this.editor.error(e);
		}
	}
	saveFileAs(ext, data){
		if(this.useNativeFS) this._saveFileAsFS(ext, data);
		else this._saveFileAsHTML(`chart.${ext}`, data);
	}
	_saveFileAsHTML(fileName, data) {
		const blob = new Blob([data], {'type': "text/plain"});

		const elem = document.createElement('a');
		elem.setAttribute('href', window.URL.createObjectURL(blob));
		elem.setAttribute('download', fileName);
		elem.style.display = 'none';

		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);

		window.URL.revokeObjectURL(blob);
	}
	async _saveFileAsFS(ext, data) {
		try{
			let fileHandle = await window.chooseFileSystemEntries({
				'type': 'saveFile', 'accepts': [{
					'description': "k-shoot mania chart file",
					'extensions': [ext],
				}],
			});

			const writer = await fileHandle.createWriter({'keepExistingData': false});
			await writer.write(0, data);
			await writer.close();
		
			this.editor.info(`File saved as ${fileHandle.name}!`);
		}catch(e){
			this.editor.error(e);
			return;
		}
	}

	showDropFileIndicator() {
		if(this.dropFileIndicatorShown) return;

		this.dropFileIndicatorShown = true;
		this.dropFileIndicator.classList.add('active');
	}
	hideDropFileIndicator() {
		if(!this.dropFileIndicatorShown) return;

		this.dropFileIndicatorShown = false;
		this.dropFileIndicator.classList.remove('active');
	}
}
