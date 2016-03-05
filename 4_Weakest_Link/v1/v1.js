$(function() {
	var r = new Redwood();
	
	function Get () {}
	Get.prototype = {
		minX : function (data) {
			var m = 11; for (var i in data) if (data[i][0] < m) m = data[i][0]; return m;
		},
		maxY : function (data) {
			var m = 11, index = -1; for (var i in data) if (data[i][0] < m) { m = data[i][0]; index = i } return data[index][1];
		},
		payoff : function (beta, alpha, all, pos) {
			return beta * this.minX(all) + alpha * (pos - this.minX(all));
		},
		average : function (beta, alpha, all) {
			var a = 0, l = 0;
			for (var i in all) {
				a += this.payoff(beta, alpha, all, all[i][0]);
				l++;
			}
			return a / l;
		},
		top : function (beta, alpha, all) {
			return this.payoff(beta, alpha, all, this.minX(all));
		},
		penalty : function (alpha, all, pos) {
			return alpha * (pos - this.minX(all));
		}
	};
	var get = new Get();
	
	function TimeKeeper () {
	
		// Redwood
		this.isMaster = false; this.master = -1;
		this.state = 'INIT';
		this.roundDurationInTicks = 60;
		this.tickSpeedInMs = 1000;
		this.currentTick = -1;
		this.totalNumOfPlayer = 0;
		
		// Graph
		this.position = {
			yours: [], // playData[3], 3
			hover: [], // playData[2], 2 
			all: [], // playData[1], 1
			curve: [], // playData[0], 0
		};
		this.payoffRate = {
			yours: 1,
			average: 1,
			top: 1,
			penalty: 0
		};
		this.playData = [{label: 'Curve', data: [], points: { show: false }, lines: { fill: true, fillColor: { colors: [{ opacity: 0.4 }, { opacity: 0.1}]}} },
						{label: 'All', data: [], lines: { show: false }},
						{label: 'Hover', data: []},
						{label: 'Yours', data: [], lines: { show: false }}];
		this.statData = [{label: 'You', data: [], points: { show: false }, lines: { fill: true, fillColor: { colors: [{ opacity: 0.7 }, { opacity: 0.1}]}} },
						{label: 'Average', data: [], points: { show: false } },
						{label: 'Top', data: [], points: { show: false } }];
		this.playOptions = {};
		this.statOptions = {};
		this.alpha = -1; this.beta = 1;
		this.alphaAutomation = []; this.betaAutomation = [];
		this.totalScore = 0;
	}
	
	TimeKeeper.prototype = {
		setup : function () {
			this.setReceive(this);
			r.send('config', {});
		},
		setReceive : function (self) {
			r.recv('config', function () {
				self.roundDurationInTicks = r.config.roundDurationInTicks;
				self.tickSpeedInMs = r.config.tickSpeedInMs;
				self.alpha = r.config.alpha; $('#alpha').text('Alpha = '+self.alpha).next().val(self.alpha);
				self.beta = r.config.beta; $('#beta').text('Beta = '+self.beta).next().val(self.beta);
				self.alphaAutomation = r.config.alphaAutomation ? JSON.parse(r.config.alphaAutomation.replace(/'/g,'"')) : [];
				self.betaAutomation = r.config.betaAutomation ? JSON.parse(r.config.betaAutomation.replace(/'/g,'"')) : [];
				self.generatePlayerID(self);
			});
			r.recv('advanceTick', function (msg) {
				self.currentTick = msg.Value;
				if (self.currentTick > self.roundDurationInTicks && self.state == 'IDLE') {
					setTimeout(function () {
						r.set_period(r.period + 1);
					}, 10000);
					self.state = "ROUND_END";
				}
				switch (self.state) {
					case 'IDLE':
						self.setPayoffRates();
						if (r.config.showYourPayoff && !self.isMaster) self.statData[0].data.push([self.currentTick, self.payoffRate.yours]);
						if (r.config.showAveragePayoff || self.isMaster) self.statData[1].data.push([self.currentTick, self.payoffRate.average]);
						if (r.config.showTopPayoff || self.isMaster) self.statData[2].data.push([self.currentTick, self.payoffRate.top]);
						self.setAutomation();
						self.loadData();
						$('#timeLeft').html('Ticks Left: '+(self.roundDurationInTicks-self.currentTick));
						break;
					case 'ROUND_END':
						break;
				}
			});
			r.recv('master', function (msg) {
				self.master = msg.Value;
				self.setupPlots();
			});
			r.recv('beta', function (msg) {
				$('#beta').html('Beta = '+msg.Value);
				self.beta = msg.Value; self.setPositions(); self.setCurve(); self.loadData();
			});
			r.recv('alpha', function (msg) {
				$('#alpha').html('Alpha = '+msg.Value);
				self.alpha = msg.Value; self.setPositions(); self.setCurve(); self.loadData();
			});
			r.recv('position', function (msg) {
				var m = msg.Value;
				self.position.all[m.subjectID] = [m.pos, get.payoff(self.beta, self.alpha, self.position.all, m.pos)];
				if (m.subjectID == self.subjectID) {
					self.position.yours = self.position.all[m.subjectID];
				}
				self.setPositions(); self.setCurve(); self.loadData();
			});
			r.recv('init', function (msg) { var m = msg.Value;
				if (m.subjectID == self.subjectID) self.position.yours = m.point;
				self.position.all[m.subjectID] = m.point;
				self.setPositions(); self.setCurve(); self.loadData();
			});
		},
		generatePlayerID : function (self) {
			var iter = 0;
			for (var key in r.groups) {
				if (key === r.username)
					this.subjectID = iter;
				iter++;
			}
			if (r.config.master == 0 && this.subjectID == 0) {
				r.send('master', -1);
				setInterval(function () { r.send('advanceTick', self.currentTick+1); }, self.tickSpeedInMs);
			} else if (document.URL.split('Subject-')[1].split('@')[0] == r.config.master) {
				r.send('master', this.subjectID); this.isMaster = true; $('.controls').show();
				setInterval(function () { r.send('advanceTick', self.currentTick+1); }, self.tickSpeedInMs);
				$('#beta').next().mousemove(function () { if (self.beta != $(this).val()) { $('#beta').html('Beta = '+$(this).val()); r.send('beta', $(this).val()); }});
				$('#alpha').next().mousemove(function () { if (self.alpha != $(this).val()) { $('#alpha').html('Alpha = '+$(this).val()); r.send('alpha', $(this).val()); }});
			}
		},
		setupPlots : function () {
			this.setupInitialValue();
			this.setOptions(this);
			this.loadData();
			this.playPlot.setupGrid();
			this.statPlot.setupGrid();
			this.setupEvents(this);
			this.setRedrawPlots(this);
			this.state = 'IDLE';
		},
		setupInitialValue : function () {
			if (this.isMaster) delete this.statData[0].label;
			else {
				var init_positions = r.config.subjectPositions;
				if (this.master != -1 && init_positions.length < r.config.groupSize) init_positions = init_positions.splice(this.master, 0, 0);
				var init_x = init_positions[this.subjectID];
				if (!init_x) init_x = Math.round(Math.random() * 10);
				r.send('init', {subjectID: this.subjectID, point: [init_x, get.payoff(this.beta, this.alpha, this.position.all, init_x)]});
				if (!r.config.showYourPayoff) delete this.statData[0].label;
				if (!r.config.showAveragePayoff) delete this.statData[1].label;
				if (!r.config.showTopPayoff) delete this.statData[2].label;
			}
		},
		setOptions : function (self) {
			this.playOptions = {
				series: { lines: { show: true }, points: { show: true } },
				legend: { show: false },
				xaxis: { min: 0, max: 10 },
				yaxis: { minTickSize: 1, min: -10, max: 10 },
				grid: { clickable: true, hoverable: true, autoHighlight: true, moutieActiveRadius: 15 }
			};
			this.statOptions = {
				series: { lines: { show: true }, points: { show: true } },
				legend: {
					labelBoxBorderColor: 'grey',
					noColumns: 3, position: "ne",
					backgroundColor: 'white', backgroundOpacity: 0.2
				},
				xaxis: { min: 0, max: self.roundDurationInTicks },
				yaxis: { minTickSize: 1, min: -10, max: 10 },
			};
		},
		setRedrawPlots : function (self) {
			setInterval(function () {
				self.playPlot.draw();
				self.statPlot.draw();
			}, 100);
		},
		setupEvents : function (self) {
			this.lastX = -1; this.lastY = -1;
			$('#playContainer').bind("plothover", function (event, pos, item) {
				$(this).css('cursor', 'pointer');
				if (!self.isMaster) {
					var x = Math.round(pos.x); if (x < 0) x = 0; else if (x > 10) x = 10;
					self.position.hover[0] = x;
				} else {
					var x = Math.round(pos.x), y = Math.round(pos.y);
					if (x < 0) x = 0; else if (x > 10) x = 10;
					if (y < 0) y = 0; else if (y > 10) y = 10;
					if (this.lastX == x && this.lastY == y) return;
				}
				self.setPositions(); self.setCurve(); self.loadData();
			});
			$('#playContainer').bind("plotclick", function (event, pos, item) {
				$(this).css('cursor', 'pointer');
				if (!self.isMaster) {
					var x = Math.round(pos.x); if (x < 0) x = 0; else if (x > 10) x = 10;
					r.send('position', {subjectID: self.subjectID, pos: x});
				}
			});
		},
		showTooltip : function (tooltip, x, y, msg) {
			$('#'+tooltip).html(msg)
				.css({
					position: 'absolute',
					top: y - 35, left: x + 7,
					background: 'black',
					color: 'white',
					border: '1px solid #AAAAFF',
					padding: '5px',
					opacity: 0.80
				}).css('border-radius', '8px')
				.show().appendTo("body").fadeIn(1000);
		},
		loadData : function () {
			this.playPlot = $.plot($('#playContainer'), this.playData, this.playOptions);
			this.statPlot = $.plot($('#statContainer'), this.statData, this.statOptions);
		},
		setPositions : function () {
			if (!this.playPlot.getPlaceholder()) return;
			var offset = $(this.playPlot.getPlaceholder()).offset(), axes = this.playPlot.getAxes();
			$('.tooltip').remove();
			var occupiedX = [];
			for (var i in this.position.all) {
				$('body').append('<div id="'+i+'" class="tooltip"></div>');
				var player = parseInt(i);
				if (player == this.subjectID) player = 'You'; else player = 'P'+player;
				this.position.all[i][1] = get.payoff(this.beta, this.alpha, this.position.all, this.position.all[i][0]);
				if (occupiedX[this.position.all[i][0]]) occupiedX[this.position.all[i][0]] += 30; else occupiedX[this.position.all[i][0]] = 50;
				this.showTooltip(i, axes.xaxis.scale * (this.position.all[i][0]) + offset.left, axes.yaxis.scale * (axes.yaxis.max - this.position.all[i][1]) + offset.top + occupiedX[this.position.all[i][0]], player);
			}
			var projections = [];
			for (var i in this.position.all) {
				if (this.position.yours[0] == get.minX(this.position.all) && this.position.hover[0] > this.position.yours[0] && i == this.subjectID)
					continue;
				else
					projections.push([this.position.all[i][0]*1,this.position.all[i][1]*1]);
			}
			projections.push([this.position.hover[0]*1, this.position.hover[1]*1]);
			for (var i in projections) {
				projections[i][1] = get.payoff(this.beta, this.alpha, projections, projections[i][0]);
			}
			if (this.position.hover[0]) {
				$('body').append('<div id="hoverTip" class="tooltip"></div>');
				this.showTooltip('hoverTip', axes.xaxis.scale * (projections[projections.length-1][0]) + offset.left, axes.yaxis.scale * (axes.yaxis.max - projections[projections.length-1][1]) + offset.top, 'set');
			}
			this.playData[3].data = [this.position.yours];
			this.playData[2].data = projections;
			this.playData[1].data = this.position.all;
		},
		setPayoffRates : function () {
			this.payoffRate.yours = get.payoff(this.beta, this.alpha, this.position.all, this.position.yours[0]);
			this.payoffRate.average = get.average(this.beta, this.alpha, this.position.all);
			this.payoffRate.top = get.top(this.beta, this.alpha, this.position.all);
			this.payoffRate.penalty = get.penalty(this.alpha, this.position.all, this.position.yours[0]);
			if (this.isMaster) {
				$('#currScore').text('Average Score: '+this.payoffRate.average.toFixed(2));
				this.totalScore += this.payoffRate.average;
				$('#totalScore').text('Average Total: '+this.totalScore.toFixed(0));
			} else {
				$('#currScore').text('Current Score: '+this.payoffRate.yours.toFixed(2));
				this.totalScore += this.payoffRate.yours;
				$('#totalScore').text('Total Score: '+this.totalScore.toFixed(0));
			}
		},
		setCurve : function () {
			var all = this.position.all, minX = get.minX(all);
			this.playData[0].data[0] = [0, 0];
			this.playData[0].data[1] = [minX, get.payoff(this.beta, this.alpha, all, minX)];
			this.playData[0].data[2] = [10, get.payoff(this.beta, this.alpha, all, 10)];
		},
		setAutomation : function () {
			var aa = this.alphaAutomation, ba = this.betaAutomation;
			for (var i = aa.length-1; i >= 0; i--) {
				if (this.currentTick >= aa[i][1]) {
					if (aa[i][0] == 'hold') {
						this.alpha = aa[i][2];
						break;
					} else if (aa[i][0] == 'linear') {
						this.alpha = ((aa[i+1][2]) / (aa[i+1][1]-aa[i][1])) * (this.currentTick - aa[i][1]);
						break;
					}
				}
			}
			for (var i = ba.length-1; i >= 0; i--) {
				if (this.currentTick >= ba[i][1]) {
					if (ba[i][0] == 'hold') {
						this.beta = ba[i][2];
						break;
					} else if (ba[i][0] == 'linear') {
						this.beta = ((ba[i+1][2]) / (ba[i+1][1]-ba[i][1])) * (this.currentTick - ba[i][1]);
						break;
					}
				}
			}
			this.setPositions(); this.setCurve();
		}
	};
	var timeKeeper = new TimeKeeper();

	r.finish_sync(function() {
		timeKeeper.setup();
	});
});