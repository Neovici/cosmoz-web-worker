(function () {
	'use strict';

	Polymer({
		is: 'cosmoz-web-worker',
		properties: {
			/**
			 * Number of workers to create for round robin distribution of work
			 * @type Number
			 */
			numThreads: {
				type: Number,
				value: 2
			},
			_callbacks: {
				type: Object,
				value: function () {
					return {};
				}
			},
			_currentThreadIndex: {
				type: Number,
				value: 0
			},
			_threads: {
				type: Array,
				value: function () {
					return [];
				}
			},
			_workerRun: {
				type: Number,
				value: 0
			}
		},
		/**
		 * The process method will relay data to the available worker thread
		 * @param  {Mixed} data The data for the worker
		 * @param  {Function} callback (optional) Callback to run for the response
		 * @returns {void}
		 */
		process: function (data, callback) {
			this._workerRun += 1;
			if (callback !== undefined) {
				this._callbacks[this._workerRun] = callback;
			}
			this._threads[this._currentThreadIndex].postMessage({
				workerRun: this._workerRun,
				data: data
			});
			if (this._currentThreadIndex + 1 < this.numThreads) {
				this._currentThreadIndex += 1;
			} else if (this._currentThreadIndex > 0) {
				this._currentThreadIndex  = 0;
			}
		},
		attached: function () {
			const workerScripts = this._getWorkerScripts(),
				promises = this._getWorkerScriptInlinePromises(workerScripts) || [];

			Promise.all(promises)
				.catch((err) => {
					console.warn('err', err);
				})
				.then(() => {
					this._startWorkers(workerScripts);
				});
		},
		detached: function () {
			let worker = this._threads.pop();
			while (worker) {
				worker.terminate();
				worker = this._threads.pop();
			}
		},
		// TODO: Use HTML Imports instead?
		_getWorkerScriptInlinePromise: function (script) {
			const url = script.getAttribute('src');

			return new Promise(function (resolve, reject) {
				const req = new XMLHttpRequest();

				req.open('GET', url);

				req.onload = function () {
					if (req.status === 200) {
						script.textContent = req.response + script.textContent;
						script.removeAttribute('src');
						resolve(req.response);
					} else {
						reject(new Error(req.statusText));
					}
				};

				req.onerror = function () {
					reject(new Error('Network Error'));
				};

				req.send();
			});
		},
		_getWorkerScriptInlinePromises: function (workerScripts) {
			return workerScripts
				.filter(script => script.hasAttribute('src'))
				.map(script => this._getWorkerScriptInlinePromise(script));
		},
		_getWorkerScripts: function () {
			const workerScriptType = 'script[type="text/worker"]';
			return Polymer.dom(this).querySelectorAll(workerScriptType);
		},
		_handleWorkerMessage: function (event) {
			const data = event.data.data,
				workerRun = event.data.workerRun,
				callback = this._callbacks[workerRun];

			if (callback) {
				callback(data);
				delete this._callbacks[workerRun];
			}

			this.fire('message', data);
		},
		_startWorkers: function (workerScripts) {
			const jsMimeType = { type: 'text/javascript' },
				workerCodeExtractor = oScript => oScript.textContent,
				workerCode = Array.prototype.map.call(workerScripts, workerCodeExtractor),
				workerMessageHandler = this._handleWorkerMessage.bind(this),
				blob = new Blob(workerCode, jsMimeType),
				objectUrl = window.URL.createObjectURL(blob);

			for (let i = 0; i < this.numThreads; i += 1) {
				const worker = new Worker(objectUrl);
				worker.addEventListener('message', workerMessageHandler);
				this._threads.push(worker);
				URL.revokeObjectURL(objectUrl);
			}

			this.fire('cosmoz-web-worker-ready');
		}
	});
}());
