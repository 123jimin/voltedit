/// A class for managing reading/writing files
class VFileManager {
	constructor(editor) {
		const elem = editor.elem;
		this.editor = editor;

		this.dropFileIndicator = elem.querySelector('.drop-file-indicator');
		this.dropFileIndicatorShown = false;
	}
	showOpenFileDialog() {
		const fileInput = document.createElement('input');
		fileInput.setAttribute('type', 'file');
		fileInput.setAttribute('accept', ".ksh, .kson");
		fileInput.addEventListener('change', (event) => {
			this.openFileList(fileInput.files);
			fileInput.remove();
		});
		fileInput.click();
	}
	openFileList(files) {
		if(files.length === 0) return false;

		// TODO: support uploading multiple files (e.g. kson + mp3)
		if(files.length !== 1) return false;

		readFileList(files).then((fileContents) => {
			console.time("Parsing");
			const chartData = VChartData.create(fileContents[0]);
			console.timeEnd("Parsing");

			if(chartData === null) {
				alert(L10N.t('error-reading-chart-data'));
				return;
			}

			this.editor.setChartData(chartData);
		}).catch((err) => {
			this.editor.error(err);
		});

		return true;
	}
	saveToKSON() {
		if(!this.editor.chartData) return;
		this.saveFile(KSONData.toKSON(this.editor.chartData), "chart.kson");
	}
	saveToKSH() {
		if(!this.editor.chartData) return;
		this.saveFile(KSHData.toKSH(this.editor.chartData), "chart.ksh");
	}
	saveFile(text, fileName) {
		const blob = new Blob([text], {'type': "text/plain"});

		const elem = document.createElement('a');
		elem.setAttribute('href', window.URL.createObjectURL(blob));
		elem.setAttribute('download', fileName);
		elem.style.display = 'none';

		document.body.appendChild(elem);
		elem.click();
		document.body.removeChild(elem);

		window.URL.revokeObjectURL(blob);
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
