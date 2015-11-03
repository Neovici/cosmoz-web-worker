/*global Blob, Polymer, Worker, window */
(function () {

	"use strict";

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
			_currentThreadIndex: {
				type: Number,
				value: 0
			},
			_threads: {
				type: Array,
				value: function () {
					return [];
				}
			}
		},
		/**
		 * The process method will relay data to the available worker thread
		 * @param  {Mixed} data The data for the worker
		 */
		process: function (data) {
			this._threads[this._currentThreadIndex].postMessage(data);
			if (this._currentThreadIndex + 1 < this.numThreads) {
				this._currentThreadIndex += 1;
			} else if (this._currentThreadIndex > 0) {
				this._currentThreadIndex  = 0;
			}
		},
		ready: function () {
			var i = 0,
				jsMimeType = { type: "text/javascript" },
				worker,
				workerScriptType = 'script[type="text/worker"]',
				workerScripts = Polymer.dom(this).querySelectorAll(workerScriptType),
				workerCodeExtractor = function (oScript) { return oScript.textContent; },
				workerCode = Array.prototype.map.call(workerScripts, workerCodeExtractor),
				workerMessageHandler = this._handleWorkerMessage.bind(this),
				blob = new Blob(workerCode, jsMimeType),
				objectUrl = window.URL.createObjectURL(blob);

			for (i = 0; i < this.numThreads; i += 1) {
				worker = new Worker(objectUrl);
				worker.addEventListener('message', workerMessageHandler);
				this._threads.push(worker);
			}
		},
		_handleWorkerMessage: function (event) {
			this.fire('message', event);
		}
	});
}());