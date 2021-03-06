Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", "SynchronizedStopWatch", function($rootScope, $scope, rs, stopwatch) {
	
	function Get () {}
	Get.prototype = {
		minX : function (data) {
			var m = rs.config.maxPos; for (var i in data) if (data[i][0] < m) m = data[i][0]; return m;
		},
		payoff : function (beta, alpha, all, pos) {
			var payoff = alpha * this.minX(all) + beta * (pos - this.minX(all));
			if (rs.config.saturateAtZero && payoff < 0) return 0;
			else return payoff;
		},
		endPoint : function (beta, alpha, all, pos) {
			return (-alpha * this.minX(all) / beta) + this.minX(all);
		},
		average : function (beta, alpha, all) {
			var a = 0, l = 0;
			for (var i in all) {
				a += all[i][1];
				l++;
			}
			return a / l;
		},
		top : function (beta, alpha, all) {
			return this.payoff(beta, alpha, all, this.minX(all));
		},
		penalty : function (beta, all, pos) {
			return beta * (pos - this.minX(all));
		},
		shuffle : function (o){ //v1.0
			for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
			return o;
		},
		compareX : function compareX(a,b) {
		  if (a[0] < b[0]) return -1;
		  if (a[0] > b[0]) return 1;
		  return 0;
		}
	};
	var get = new Get();
	
	function TimeKeeper () {
	
		// Redwood
		this.state = 'INIT';
		this.roundDurationInSeconds = 60;
		this.usernames = [];
		
		// Graph
		this.position = {
			yours: [], // playData[3], 3
			hover: [], // playData[2], 2 
			all: [], // playData[1], 1
			curve: [] // playData[0], 0
		};
		this.payoffRate = {
			yours: 1,
			average: 1,
			top: 1,
			penalty: 0
		};
		this.playData = [{label: 'Curve', data: [], points: { show: false }, lines: { show: true, color: 'green' }},
						{label: 'All', data: [], points: { show: true }, lines: { show: false }},
						{label: 'Hover', data: [], points: { show: true }},
						{label: 'Yours', data: [], points: { show: true }, lines: { show: false }}];
		this.statData = [{label: 'You', data: [], points: { show: false }, lines: { fill: true, fillColor: 'rgba(0,255,0,0.5)'}},
						{label: 'Average', data: [], points: { show: false } },
						{label: 'Top', data: [], points: { show: false } },
						{data: [], points: { show: false }, lines: { fill: true, fillColor: 'rgba(255,0,0,0.5)'}}];
		this.playOptions = {};
		this.statOptions = {};
		this.alpha = -1; this.beta = 1;
		this.alphaAutomation = []; this.betaAutomation = [];
		this.totalScore = 0;
		this.setReceive();
	}
	
	TimeKeeper.prototype = {
		setReceive : function () { var self = this;
			// Config
			self.roundDurationInSeconds = rs.config.roundDurationInSeconds ? rs.config.roundDurationInSeconds : 60;
			self.alpha = 1; self.beta = -1;
			self.minPos = !isNaN(rs.config.minPos) ? rs.config.minPos : 0;
			self.maxPos = !isNaN(rs.config.maxPos) ? rs.config.maxPos : 10;
			self.minPay = rs.config.minPay; self.maxPay = rs.config.maxPay;
			self.alphaAutomation = rs.config.alphaAutomation ? JSON.parse(rs.config.alphaAutomation.replace(/'/g,'"')) : [];
			self.betaAutomation = rs.config.betaAutomation ? JSON.parse(rs.config.betaAutomation.replace(/'/g,'"')) : [];
			self.minBeta = rs.config.minBeta ? rs.config.minBeta : -5;
			$scope.rounds = $scope.config.rounds || 1; $scope.round = 0;
			self.subjectID = rs.user_id; self.frameRate = 4;
			self.hideLabel = rs.config.hideLabel;
			self.grouping = rs.config.grouping;
			self.saturateAtZero = rs.config.saturateAtZero;
			if (rs.config.hideOtherPlayers) {
				self.playData[1].points.show = false;
				self.playData[2].points.show = false;
			}
			
			// Ticks
			var checkTime = function() {
				if (!$scope.stopwatch) {
					$scope.timeRemaining = 0;
					$scope.stopwatch = stopwatch.instance()
						.frequency(self.frameRate)
						.duration(self.roundDurationInSeconds)
						.onTick(function(tick, t) {
							$scope.timeRemaining = $scope.timeTotal - t;
							$scope.tick = tick;
							if (rs.config.hideTimer) $('#timer').hide();
							switch (self.state) {
								case 'INIT':
									self.setGroup();
									self.setupPlots();
									self.state = 'IDLE';
									break;
								case 'IDLE':
									self.setPayoffRates();
									if (rs.config.showYourPayoff) {
										var select = self.payoffRate.yours > 0 ? [0,3] : [3,0];
										self.statData[select[0]].data.push([tick/self.frameRate, self.payoffRate.yours]);
										self.statData[select[1]].data.push([tick/self.frameRate, 0]);
									}
									if (rs.config.showAveragePayoff) self.statData[1].data.push([tick/self.frameRate, self.payoffRate.average]);
									if (rs.config.showTopPayoff) self.statData[2].data.push([tick/self.frameRate, self.payoffRate.top]);
									self.setAutomation(tick);
									self.loadData();
									$('#timeLeft').html('Seconds Left:<br>'+($scope.config.roundDurationInSeconds-t));
									// if (self.subjectID % rs.subjects.length == 0)
										// rs.trigger("echo", {time: (tick/self.frameRate).toFixed(2), alpha: self.alpha, beta: self.beta});
									break;
							}
						})
						.onComplete(function() {
							$scope.timeRemaining = 0;
							$scope.roundStartTime = null;
							rs.trigger("next_round");
						}).start();
				} else {
					$scope.stopwatch.duration($scope.stopwatch.getDurationInTicks() + $scope.config.roundDurationInSeconds - $scope.timeRemaining);
				}
				$scope.timeTotal = $scope.stopwatch.getDurationInTicks() / self.frameRate;
			};
			rs.on("next_period", function() {
				rs.next_period();
			});
			rs.on('next_round', function () {
				rs.set_points(self.totalScore);
				if($scope.rounds && $scope.round >= $scope.rounds) {
					rs.trigger("next_period");
					return;
				}
				$scope.round++;
				rs.synchronizationBarrier('round-' + $scope.round).then(function() {
					$scope.roundStartTime = (new Date()).getTime() / 1000;
					rs.trigger("roundStartTime", $scope.roundStartTime);
					checkTime();
				});
			});
			rs.recv("next_round", function() {
				if ($scope.roundStartTime) {
					$scope.roundStartTime = null;
					rs.trigger("next_round");
				}
			});
			rs.on("roundStartTime", function(roundStartTime) {
				$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
			});
			rs.recv("roundStartTime", function(sender, roundStartTime) {
				$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
			});
			
			rs.on('beta', function (m) {
				$('#beta').html('Beta = '+m.beta);
				self.beta = m.beta; self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.on('alpha', function (m) {
				$('#alpha').html('Alpha = '+m.alpha);
				self.alpha = m.alpha; self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.on('position', function (m) {
				if (m.group != self.group) return;
				self.position.all[m.subjectID] = [m.pos, get.payoff(self.beta, self.alpha, self.position.all, m.pos)];
				if (m.subjectID == self.subjectID) {
					self.position.yours = self.position.all[m.subjectID];
				}
				self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.on('init', function (m) {
				if (m.group != self.group) return;
				if (m.subjectID == self.subjectID) self.position.yours = m.point;
				rs.trigger('changeNames', {group: self.group, names: get.shuffle(rs.subjects)});
				self.position.all[m.subjectID] = m.point;
				self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.recv('beta', function (sender, m) {
				$('#beta').html('Beta = '+m.beta);
				self.beta = m.beta; self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.recv('alpha', function (sender, m) {
				$('#alpha').html('Alpha = '+m.alpha);
				self.alpha = m.alpha; self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.recv('position', function (sender, m) {
				if (m.group != self.group) return;
				self.position.all[m.subjectID] = [m.pos, get.payoff(self.beta, self.alpha, self.position.all, m.pos)];
				if (m.subjectID == self.subjectID) {
					self.position.yours = self.position.all[m.subjectID];
				}
				self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.recv('init', function (sender, m) {
				if (m.group != self.group) return;
				if (m.subjectID == self.subjectID) self.position.yours = m.point;
				self.position.all[m.subjectID] = m.point;
				self.setPositions(); self.setCurve(); self.loadData();
			});
			rs.on('changeNames', function (m) {
				if (m.group != self.group) return;
				for (var i = 0; i < m.names.length; i++) {
					self.usernames[m.names[i].user_id] = i+1;
				}
			});
			rs.recv('changeNames', function (sender, m) {
				if (m.group != self.group) return;
				for (var i = 0; i < m.names.length; i++) {
					self.usernames[m.names[i].user_id] = i+1;
				}
			});
		},
		setGroup : function () {
			for (var group = 0; group < this.grouping.length; group++) {
				for (var i = 0; i < this.grouping[group].length; i++) {
					if (this.grouping[group][i] == this.subjectID) { this.group = group; break; }
				}
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
		},
		setupInitialValue : function () {
			var init_positions = rs.config.subjectPositions;
			var init_x;
			if (!init_positions) init_x = Math.round(this.minPos + Math.random() * (this.maxPos - this.minPos));
			else init_x = init_positions[this.group][(this.subjectID-1)%this.grouping[this.group].length];
			this.selectedPosition = init_x;
			rs.trigger('init', {group: this.group, subjectID: this.subjectID, point: [init_x, get.payoff(this.beta, this.alpha, this.position.all, init_x)]});
			if (!rs.config.showYourPayoff) delete this.statData[0].label;
			if (!rs.config.showAveragePayoff) delete this.statData[1].label;
			if (!rs.config.showTopPayoff) delete this.statData[2].label;
		},
		setOptions : function (self) {
			this.playOptions = {
				series: { lines: { show: true }, points: { show: true } },
				legend: { show: false },
				xaxis: { min: self.minPos, max: self.maxPos },
				yaxis: { minTickSize: 1 },
				grid: { clickable: true, hoverable: true, autoHighlight: true, moutieActiveRadius: 15 }
			};
			if (self.maxPay) this.playOptions.yaxis.max = self.maxPay;
			if (self.minPay) this.playOptions.yaxis.min = self.minPay;
			this.statOptions = {
				series: { lines: { show: true }, points: { show: true } },
				legend: {
					labelBoxBorderColor: 'grey',
					noColumns: 3, position: "ne",
					backgroundOpacity: 0,
					labelFormatter: function(label, series) {
						if (label == "You") series.color = 'rgba(100,255,100,1)';
						else if (label == "Penalty") series.color = 'red';
						return '<span style="margin:3px;">'+label+'</span>';
					}
				},
				xaxis: { min: 0, max: self.roundDurationInSeconds },
				yaxis: { minTickSize: 1 }
			};
			if (self.maxPay) this.statOptions.yaxis.max = self.maxPay;
			if (self.minPay) this.statOptions.yaxis.min = self.minPay;
		},
		setRedrawPlots : function (self) {
			setInterval(function () {
				self.playPlot.draw();
				self.statPlot.draw();
			}, 200);
		},
		setupEvents : function (self) {
			this.lastX = -1; this.lastY = -1; var x;
			$('#playContainer').bind("plothover", function (event, pos, item) {
				$(this).css('cursor', 'pointer');
				x = Math.round(pos.x);
				if (x <= self.minPos) x = self.minPos; else if (x > self.maxPos) x = self.maxPos;
				self.position.hover[0] = x; self.selectedPosition = x;
				self.setPositions(); self.setCurve(); self.loadData();
			});
			$('#playContainer').bind("plotclick", function (event, pos, item) {
				$(this).css('cursor', 'pointer');
				var x = Math.round(pos.x); if (x < self.minPos) x = self.minPos; else if (x > self.maxPos) x = self.maxPos;
				rs.trigger('position', {group: self.group, subjectID: self.subjectID, pos: x, alpha: self.alpha, beta: self.beta, time: $scope.timeTotal - $scope.timeRemaining});
			});
			window.onkeydown = function (e) {
				if (e.which == 37 || e.which == 39 || e.which == 13) self.position.hover = [];
				if (e.which == 37 && self.selectedPosition > self.minPos) self.selectedPosition--;
				else if (e.which == 39 && self.selectedPosition < self.maxPos) self.selectedPosition++;
				else if (e.which == 13) rs.trigger('position', {group: self.group, subjectID: self.subjectID, pos: self.selectedPosition, beta: self.beta, time: $scope.timeTotal - $scope.timeRemaining});
				self.position.hover[0] = self.selectedPosition;
			};
		},
		showTooltip : function (tooltip, x, y, msg) {
			if (this.hideLabel && msg != 'set' && msg != 'You') return;
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
			if (!this.playPlot || !this.playPlot.getPlaceholder()) return;
			var offset = $(this.playPlot.getPlaceholder()).offset(), axes = this.playPlot.getAxes();
			$('.tooltip').remove();
			var occupiedX = [];
			for (var i in this.position.all) {
				var player = parseInt(i,10); if (!player) continue;
				$('body').append('<div id="'+i+'" class="tooltip"></div>');
				if (player == this.subjectID) player = 'You'; else player = 'P'+this.usernames[player];
				this.position.all[i][1] = get.payoff(this.beta, this.alpha, this.position.all, this.position.all[i][0]);
				if (occupiedX[this.position.all[i][0]]) occupiedX[this.position.all[i][0]] += 30; else occupiedX[this.position.all[i][0]] = 50;
				this.showTooltip(i, axes.xaxis.scale * (this.position.all[i][0] - this.minPos) + offset.left, axes.yaxis.scale * (axes.yaxis.max - this.position.all[i][1]) + offset.top + occupiedX[this.position.all[i][0]], player);
			}
			if (!(this.position.hover[0])) this.position.hover = [this.position.yours[0], 0];
			var projections = [].concat(this.position.all),
				hasSaturation = false;
			projections[this.subjectID] = this.position.hover;
			for (var i in projections) {
				projections[i][1] = get.payoff(this.beta, this.alpha, projections, projections[i][0]);
				if (projections[i][1] == 0) hasSaturation = true;
			}
			var selected = [this.position.hover[0], get.payoff(this.beta, this.alpha, projections, this.position.hover[0])];
			if (this.saturateAtZero && hasSaturation)
				projections.push([get.endPoint(this.beta, this.alpha, projections, this.maxPos), 0]);
			$('body').append('<div id="hoverTip" class="tooltip"></div>');
			this.showTooltip('hoverTip', axes.xaxis.scale * (selected[0] - this.minPos) + offset.left, axes.yaxis.scale * (axes.yaxis.max - selected[1]) + offset.top, 'set');
			this.playData[3].data = [this.position.yours, selected];
			this.playData[2].data = projections.sort(get.compareX);
			this.playData[1].data = this.position.all;
		},
		setPayoffRates : function () {
			this.payoffRate.yours = get.payoff(this.beta, this.alpha, this.position.all, this.position.yours[0]);
			this.payoffRate.average = get.average(this.beta, this.alpha, this.position.all);
			this.payoffRate.top = get.top(this.beta, this.alpha, this.position.all);
			if (this.saturateAtZero) {
				for (var type in this.payoffRate)
					if (this.payoffRate[type] < 0) this.payoffRate[type] = 0;
			}
			this.payoffRate.penalty = get.penalty(this.beta, this.position.all, this.position.yours[0]);
			var penalty = this.beta / this.minBeta;// = -this.beta * ((this.position.yours[0] - get.minX(this.position.all)) / (2 * (this.maxPos - this.minPos)));
			var scale = this.frameRate * this.roundDurationInSeconds;
			$('#currScore').html('Earning Rate:<br>'+(this.payoffRate.yours / scale).toFixed(3));
			this.totalScore += (this.payoffRate.yours / scale);
			$('#earnings').html('Earnings:<br>'+this.totalScore.toFixed(3));
			$('#penalty').css('width', penalty.toFixed(2) * 100 + '%');
		},
		setCurve : function () {
			var isMin = this.position.yours[0] == get.minX(this.position.all);
			var all = [].concat(this.position.all).sort(get.compareX);
			if (isMin) all.shift();
			var minX = get.minX(all), endPoint = get.endPoint(this.beta, this.alpha, all, this.maxPos);
			this.playData[0].data[0] = [0, 0];
			this.playData[0].data[1] = [minX, get.payoff(this.beta, this.alpha, all, minX)];
			this.playData[0].data[2] = [endPoint, 0];
			this.playData[0].data[3] = [this.maxPos, get.payoff(this.beta, this.alpha, all, this.maxPos)];
		},
		setAutomation : function (tick) { var self = this;
			var aa = this.alphaAutomation, ba = this.betaAutomation, node = tick / self.frameRate;
			for (var i = aa.length-1; i >= 0; i--) {
				if (node >= aa[i][1]) {
					if (aa[i][0] == 'linear' && aa[i+1]) {
						this.alpha = aa[i][2] + (aa[i+1][2] - aa[i][2]) * (node - aa[i][1]) / (aa[i+1][1] - aa[i][1]);
						break;
					} else {
						this.alpha = aa[i][2];
						break;
					}
				}
			}
			for (var i = ba.length-1; i >= 0; i--) {
				if (node >= ba[i][1]) {
					if (ba[i][0] == 'linear' && ba[i+1]) {
						this.beta = ba[i][2] + (ba[i+1][2] - ba[i][2]) * (node - ba[i][1]) / (ba[i+1][1] - ba[i][1]);
						break;
					} else {
						this.beta = ba[i][2];
						break;
					}
				}
			}
			this.setPositions(); this.setCurve();
		}
	};
		
	rs.on_load(function() {
		var timeKeeper = new TimeKeeper();
		rs.trigger("next_round");
	});
}]);
