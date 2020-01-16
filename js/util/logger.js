/// Just a thin wrapper
const logger = Object.freeze({
	'error': (err) => window.editor ? window.editor.error(err) : console.error(err, err && err.stack),
	'warn': (message) => window.editor ? window.editor.warn(message) : console.warn(message),
	'log': (message) => console.log(message)
});
